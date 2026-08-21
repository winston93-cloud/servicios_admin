/**
 * 2026-08-21 - PDF de ejemplo (acuerdo de beca) para prototipo de firma electrónica.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export async function crearAcuerdoBecaPdfBytes(opts?: {
  alumnoNombre?: string
  control?: string
  cicloLabel?: string
}): Promise<Uint8Array> {
  const alumno = opts?.alumnoNombre?.trim() || 'ALUMNO DE EJEMPLO'
  const control = opts?.control?.trim() || '21999'
  const ciclo = opts?.cicloLabel?.trim() || '2026-2027'

  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792]) // Letter
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const marginX = 54
  let y = 740

  const draw = (
    text: string,
    size: number,
    bold = false,
    color = rgb(0.12, 0.14, 0.2)
  ) => {
    page.drawText(text, {
      x: marginX,
      y,
      size,
      font: bold ? fontBold : font,
      color,
    })
  }

  draw('INSTITUTO WINSTON CHURCHILL', 14, true, rgb(0.05, 0.2, 0.45))
  y -= 22
  draw('Acuerdo de renovación de beca (documento de prueba)', 12, true)
  y -= 28
  draw(`Ciclo escolar: ${ciclo}`, 11)
  y -= 18
  draw(`Alumno: ${alumno}`, 11)
  y -= 18
  draw(`No. de control: ${control}`, 11)
  y -= 32

  const paragrafos = [
    'Este documento es un prototipo interno para probar la captura e incrustación de firma electrónica en Servicios Administrativos.',
    'El firmante declara haber leído las condiciones del programa de becas y acepta renovar el beneficio para el ciclo indicado, sujeto a la normativa vigente del instituto.',
    'La firma que se dibuje a continuación se incrustará en este PDF únicamente con fines de demostración técnica. No sustituye un trámite oficial hasta que el flujo productivo quede autorizado.',
    'Espacio reservado para la firma del padre, madre o tutor:',
  ]

  for (const p of paragrafos) {
    const lines = wrapText(p, 78)
    for (const line of lines) {
      draw(line, 10)
      y -= 15
    }
    y -= 10
  }

  // Caja de firma (coords PDF: origen abajo-izquierda)
  const boxX = marginX
  const boxY = 96
  const boxW = 280
  const boxH = 90
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    borderColor: rgb(0.55, 0.6, 0.68),
    borderWidth: 1,
    color: rgb(0.97, 0.98, 0.99),
  })
  page.drawText('Firma', {
    x: boxX + 8,
    y: boxY + boxH - 16,
    size: 9,
    font,
    color: rgb(0.45, 0.48, 0.55),
  })
  page.drawLine({
    start: { x: boxX + 16, y: boxY + 22 },
    end: { x: boxX + boxW - 16, y: boxY + 22 },
    thickness: 0.8,
    color: rgb(0.7, 0.72, 0.78),
  })

  page.drawText('Fecha: ____________________', {
    x: boxX + boxW + 24,
    y: boxY + 40,
    size: 10,
    font,
    color: rgb(0.2, 0.22, 0.28),
  })

  page.drawText('Prototipo · Servicios Administrativos · Winston', {
    x: marginX,
    y: 36,
    size: 8,
    font,
    color: rgb(0.5, 0.52, 0.58),
  })

  return doc.save()
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const next = current ? `${current} ${w}` : w
    if (next.length > maxChars && current) {
      lines.push(current)
      current = w
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

/** Rectángulo donde se incrusta la firma (mismo layout que crearAcuerdoBecaPdfBytes). */
export const FIRMA_BOX = {
  x: 54,
  y: 96,
  width: 280,
  height: 90,
} as const
