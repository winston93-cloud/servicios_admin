/**
 * 2026-08-21 - Incrusta PNG de firma en el PDF de prueba (pdf-lib, cliente).
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { FIRMA_BOX } from './crearAcuerdoBecaPdf'

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
  firmaPngDataUrl: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes)
  const page = doc.getPages()[0]
  if (!page) throw new Error('El PDF no tiene páginas.')

  const pngBytes = dataUrlToUint8Array(firmaPngDataUrl)
  const png = await doc.embedPng(pngBytes)

  const pad = 10
  const maxW = FIRMA_BOX.width - pad * 2
  const maxH = FIRMA_BOX.height - 28
  const scale = Math.min(maxW / png.width, maxH / png.height)
  const drawW = png.width * scale
  const drawH = png.height * scale

  // Fondo limpio sobre la caja
  page.drawRectangle({
    x: FIRMA_BOX.x,
    y: FIRMA_BOX.y,
    width: FIRMA_BOX.width,
    height: FIRMA_BOX.height,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.15, 0.45, 0.75),
    borderWidth: 1.2,
  })

  page.drawImage(png, {
    x: FIRMA_BOX.x + pad,
    y: FIRMA_BOX.y + 18,
    width: drawW,
    height: drawH,
  })

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const ahora = new Date()
  const fecha = ahora.toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  page.drawText(`Firmado electrónicamente · ${fecha}`, {
    x: FIRMA_BOX.x + 8,
    y: FIRMA_BOX.y + 6,
    size: 7,
    font,
    color: rgb(0.25, 0.35, 0.45),
  })

  return doc.save()
}
