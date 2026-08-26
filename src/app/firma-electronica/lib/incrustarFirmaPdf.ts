/**
 * 2026-08-21 - Incrusta PNG de firma en un PDF (pdf-lib, cliente).
 * El trazo va en la caja; la fecha a la derecha; el nombre del tutor debajo de la línea.
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

function normalizarNombreTutor(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

function ajustarTamanoNombre(
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  nombre: string,
  maxWidth: number
): { size: number; text: string } {
  const sizes = [11, 10, 9, 8.5, 8, 7.5]
  for (const size of sizes) {
    if (font.widthOfTextAtSize(nombre, size) <= maxWidth) {
      return { size, text: nombre }
    }
  }
  let text = nombre
  let size = 7.5
  while (text.length > 8 && font.widthOfTextAtSize(`${text}…`, size) > maxWidth) {
    text = text.slice(0, -1)
  }
  return { size, text: text.length < nombre.length ? `${text}…` : text }
}

export async function incrustarFirmaEnPdf(
  pdfBytes: Uint8Array,
  firmaPngDataUrl: string,
  firmaBox: FirmaBox,
  nombreTutor: string
): Promise<Uint8Array> {
  const nombre = normalizarNombreTutor(nombreTutor)
  if (!nombre) throw new Error('Captura el nombre del padre, madre o tutor(a).')

  const doc = await PDFDocument.load(pdfBytes)
  const page = doc.getPages()[firmaBox.pageIndex]
  if (!page) throw new Error('El PDF no tiene la página de firma.')

  const pngBytes = dataUrlToUint8Array(firmaPngDataUrl)
  const png = await doc.embedPng(pngBytes)

  const padX = 6
  const lineY = firmaBox.y + 28
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

  const fontNombre = await doc.embedFont(StandardFonts.TimesRoman)
  const fontFecha = await doc.embedFont(StandardFonts.Helvetica)
  const maxNombreW = firmaBox.nombreMaxWidth || firmaBox.width - 32
  const { size: nombreSize, text: nombreDibujado } = ajustarTamanoNombre(
    fontNombre,
    nombre,
    maxNombreW
  )
  const nombreW = fontNombre.widthOfTextAtSize(nombreDibujado, nombreSize)
  page.drawRectangle({
    x: firmaBox.x + 12,
    y: firmaBox.y + 4,
    width: firmaBox.width - 24,
    height: 18,
    color: rgb(1, 1, 1),
  })
  page.drawText(nombreDibujado, {
    x: firmaBox.x + (firmaBox.width - nombreW) / 2,
    y: firmaBox.nombreY || lineY - 14,
    size: nombreSize,
    font: fontNombre,
    color: rgb(0.1, 0.12, 0.16),
  })

  const ahora = new Date()
  const fecha = ahora.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const fechaSize = 9
  const fechaW = fontFecha.widthOfTextAtSize(fecha, fechaSize)
  const fechaCenterX = firmaBox.fechaCenterX
  const fechaValorY = firmaBox.fechaValorY || firmaBox.y + 58
  page.drawRectangle({
    x: fechaCenterX - fechaColHalfWidth(firmaBox),
    y: fechaValorY - 4,
    width: fechaColHalfWidth(firmaBox) * 2,
    height: 20,
    color: rgb(1, 1, 1),
  })
  page.drawText(fecha, {
    x: fechaCenterX - fechaW / 2,
    y: fechaValorY,
    size: fechaSize,
    font: fontFecha,
    color: rgb(0.04, 0.16, 0.32),
  })

  return doc.save()
}

function fechaColHalfWidth(firmaBox: FirmaBox): number {
  return Math.max(60, (firmaBox.nombreMaxWidth || 120) * 0.42)
}
