/**
 * 2026-08-21 - Incrusta PNG de firma en un PDF (pdf-lib, cliente).
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { FirmaBox } from './plantillasNivel'
import { plantillaPorNivel } from './plantillasNivel'

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
  firmaBox: FirmaBox = plantillaPorNivel('secundaria').firmaBox
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes)
  const page = doc.getPages()[firmaBox.pageIndex]
  if (!page) throw new Error('El PDF no tiene la página de firma.')

  const pngBytes = dataUrlToUint8Array(firmaPngDataUrl)
  const png = await doc.embedPng(pngBytes)

  const pad = 8
  const maxW = firmaBox.width - pad * 2
  const maxH = firmaBox.height - 22
  const scale = Math.min(maxW / png.width, maxH / png.height)
  const drawW = png.width * scale
  const drawH = png.height * scale

  // Fondo blanco suave para tapar firma manuscrita previa (si la hubiera)
  page.drawRectangle({
    x: firmaBox.x,
    y: firmaBox.y + 16,
    width: firmaBox.width,
    height: firmaBox.height - 16,
    color: rgb(1, 1, 1),
  })

  page.drawImage(png, {
    x: firmaBox.x + pad,
    y: firmaBox.y + 18,
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
    x: firmaBox.x + 8,
    y: firmaBox.y + 4,
    size: 8,
    font,
    color: rgb(0.2, 0.25, 0.35),
  })

  return doc.save()
}
