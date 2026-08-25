/**
 * 2026-08-21 - Incrusta PNG de firma en un PDF (pdf-lib, cliente).
 * El trazo va en la caja; la fecha se escribe a la derecha (FECHA DE FIRMA).
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { FirmaBox } from './plantillasNivel'

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]
  if (!base64) throw new Error('Firma inválida (sin datos).')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function incrustarFirmaEnPdf(
  pdfBytes: Uint8Array,
  firmaPngDataUrl: string,
  firmaBox: FirmaBox
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes)
  const page = doc.getPages()[firmaBox.pageIndex]
  if (!page) throw new Error('El PDF no tiene la página de firma.')

  const pngBytes = dataUrlToUint8Array(firmaPngDataUrl)
  const png = await doc.embedPng(pngBytes)

  const padX = 6
  const lineY = firmaBox.y + 22
  const sigBottom = lineY + 2
  const maxW = Math.max(24, firmaBox.width - padX * 2)
  const maxH = Math.max(24, firmaBox.y + firmaBox.height - sigBottom - 4)
  const scale = Math.min(maxW / png.width, maxH / png.height)
  const drawW = png.width * scale
  const drawH = png.height * scale

  const areaH = firmaBox.y + firmaBox.height - sigBottom
  const drawX = firmaBox.x + (firmaBox.width - drawW) / 2
  const drawY = sigBottom + (areaH - drawH) / 2

  page.drawRectangle({
    x: firmaBox.x,
    y: sigBottom,
    width: firmaBox.width,
    height: areaH,
    color: rgb(1, 1, 1),
  })

  page.drawImage(png, {
    x: drawX,
    y: drawY,
    width: drawW,
    height: drawH,
  })

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const ahora = new Date()
  const fecha = ahora.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  page.drawText(fecha, {
    x: firmaBox.fechaX,
    y: firmaBox.fechaY,
    size: 9,
    font,
    color: rgb(0.04, 0.16, 0.32),
  })

  return doc.save()
}
