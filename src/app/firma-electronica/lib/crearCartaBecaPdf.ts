/**
 * 2026-08-21 - Carta «Resolución de Beca» (PDF).
 * Diseño unificado: minimalista, institucional, premium.
 * Preescolar / Primaria / Secundaria comparten el mismo sistema visual.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { DATOS_PRUEBA_POR_NIVEL, type DatosCartaBeca } from './datosPruebaCartas'
import type { FirmaBox, NivelFirma } from './plantillasNivel'

const PAGE_W = 612
const PAGE_H = 792
const MX = 56
const CONTENT_W = PAGE_W - MX * 2

/** Azul del logo Winston W + neutros */
const BLUE = rgb(0.0, 0.34, 0.68) // #0057AD
const BLUE_DEEP = rgb(0.04, 0.16, 0.32)
const BLUE_SOFT = rgb(0.93, 0.96, 0.99) // fondo sutil
const BLUE_LINE = rgb(0.78, 0.86, 0.94)
const GREEN = rgb(0.55, 0.78, 0.25) // acento mínimo del logo
const INK = rgb(0.12, 0.14, 0.18)
const MUTED = rgb(0.42, 0.46, 0.52)
const WHITE = rgb(1, 1, 1)

const LOGO_PREESCOLAR = '/logos/logo-winston-educativo.png'
const LOGO_W = '/logos/logo-winston-w.png'

const META_NIVEL: Record<
  NivelFirma,
  { nivelLabel: string; logoUrl: string; direccion: string[]; pieVerde?: boolean }
> = {
  'maternal-kinder': {
    nivelLabel: 'Preescolar',
    logoUrl: LOGO_PREESCOLAR,
    direccion: [
      'CALLE 2 #209 COL. JARDÍN 20 DE NOV. · CD. MADERO, TAM. C.P. 89440',
      'PREESCOLAR · SEP 9607196 · clave 28PJN0213T',
    ],
    pieVerde: true,
  },
  primaria: {
    nivelLabel: 'Primaria',
    logoUrl: LOGO_W,
    direccion: [
      'CALLE 3 #309 COL. JARDÍN 20 DE NOVIEMBRE · CP. 89440 CD. MADERO, TAM',
      'C.C.T. 28PES0124J',
    ],
  },
  secundaria: {
    nivelLabel: 'Secundaria',
    logoUrl: LOGO_W,
    direccion: [
      'CALLE 3 #309 COL. JARDÍN 20 DE NOVIEMBRE · CP. 89440 CD. MADERO, TAM',
      'C.C.T. 28PES0124J',
    ],
  },
}

const CONDICIONES_BASE = [
  'Presentar buena conducta.',
  'Los padres de familia deberán colaborar directamente en actividades convocadas por el instituto.',
  'Si el pago de colegiaturas no se hiciera en tiempo (dentro de los 10 primeros días naturales del mes) no se hará efectivo el descuento de la beca.',
  'Renovar anualmente la solicitud de beca el mes de Julio.',
]

export type CartaGenerada = {
  bytes: Uint8Array
  firmaBox: FirmaBox
}

async function fetchPng(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (font.widthOfTextAtSize(next, size) > maxW && cur) {
      lines.push(cur)
      cur = w
    } else {
      cur = next
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function drawWrapped(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  maxW: number,
  lineH: number,
  color = INK
): number {
  let yy = y
  for (const line of wrapText(text, font, size, maxW)) {
    page.drawText(line, { x, y: yy, size, font, color })
    yy -= lineH
  }
  return yy
}

/** Bloque de datos tipo card: limpio, sin bordes pesados ni amarillo. */
function drawDatosCard(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  yTop: number,
  datos: DatosCartaBeca
): number {
  const cardH = 118
  const y = yTop - cardH

  page.drawRectangle({
    x: MX,
    y,
    width: CONTENT_W,
    height: cardH,
    color: BLUE_SOFT,
  })
  // Acento izquierdo fino
  page.drawRectangle({
    x: MX,
    y,
    width: 3,
    height: cardH,
    color: BLUE,
  })

  const pad = 18
  const colGap = 16
  const colW = (CONTENT_W - pad * 2 - colGap) / 2
  const leftX = MX + pad
  const rightX = leftX + colW + colGap
  let row1 = yTop - 28
  let row2 = yTop - 78

  const drawField = (
    label: string,
    value: string,
    x: number,
    baseline: number,
    emphasize = false
  ) => {
    page.drawText(label.toUpperCase(), {
      x,
      y: baseline,
      size: 7,
      font: fontBold,
      color: MUTED,
    })
    const vSize = emphasize ? 22 : value.length > 26 ? 9 : 11
    const vFont = emphasize ? fontBold : fontBold
    const vColor = emphasize ? BLUE : BLUE_DEEP
    const lines = wrapText(value, vFont, vSize, colW - 4)
    let vy = baseline - (emphasize ? 26 : 16)
    for (const line of lines.slice(0, emphasize ? 1 : 2)) {
      page.drawText(line, { x, y: vy, size: vSize, font: vFont, color: vColor })
      vy -= vSize + 2
    }
  }

  drawField('Grado a cursar', datos.grado, leftX, row1)
  drawField('Nombre del alumno', datos.alumnoNombre, rightX, row1)
  drawField('Porcentaje', datos.porcentaje, leftX, row2, true)
  drawField('Tipo de beca', datos.tipoBeca, rightX, row2)

  return y - 28
}

function drawCondiciones(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  yStart: number,
  datos: DatosCartaBeca
): number {
  let y = yStart
  page.drawText('Condiciones para conservar la beca', {
    x: MX,
    y,
    size: 10,
    font: fontBold,
    color: BLUE_DEEP,
  })
  y -= 6
  page.drawRectangle({
    x: MX,
    y: y - 1,
    width: 48,
    height: 1.5,
    color: BLUE,
  })
  y -= 20

  const items = [
    `Promedio mínimo Winston de ${datos.promedioMinimo} (${datos.promedioMinimoLetras}).`,
    ...(datos.condicionesExtra || []),
    ...CONDICIONES_BASE,
  ]

  for (const item of items) {
    page.drawCircle({
      x: MX + 4,
      y: y + 3,
      size: 2.2,
      color: BLUE,
    })
    y = drawWrapped(page, item, MX + 16, y, font, 9.5, CONTENT_W - 20, 13, INK)
    y -= 10
  }
  return y
}

/** Genera el PDF de resolución de beca del nivel indicado. */
export async function crearCartaBecaPdf(
  nivel: NivelFirma,
  datosOverride?: Partial<DatosCartaBeca>
): Promise<CartaGenerada> {
  const datos: DatosCartaBeca = {
    ...DATOS_PRUEBA_POR_NIVEL[nivel],
    ...datosOverride,
  }
  const meta = META_NIVEL[nivel]

  const doc = await PDFDocument.create()
  const page = doc.addPage([PAGE_W, PAGE_H])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  // —— Top bar sutil ——
  page.drawRectangle({ x: 0, y: PAGE_H - 4, width: PAGE_W, height: 4, color: BLUE })
  page.drawRectangle({ x: 0, y: PAGE_H - 6, width: 96, height: 2, color: GREEN })

  // —— Header ——
  const logoBytes = await fetchPng(meta.logoUrl)
  let logoBottom = PAGE_H - 92
  if (logoBytes) {
    const logo = await doc.embedPng(logoBytes)
    const maxH = nivel === 'maternal-kinder' ? 68 : 54
    const scale = maxH / logo.height
    const w = logo.width * scale
    const h = logo.height * scale
    page.drawImage(logo, { x: MX, y: PAGE_H - 22 - h, width: w, height: h })
    logoBottom = PAGE_H - 22 - h
  }

  const headX = MX + (nivel === 'maternal-kinder' ? 82 : 72)
  page.drawText('Instituto Winston Churchill', {
    x: headX,
    y: PAGE_H - 42,
    size: 12,
    font: fontBold,
    color: BLUE_DEEP,
  })
  page.drawText(meta.nivelLabel, {
    x: headX,
    y: PAGE_H - 58,
    size: 9,
    font,
    color: MUTED,
  })

  const asunto = `ASUNTO: RESOLUCIÓN DE BECA ${datos.cicloLabel}`
  const asuntoSize = 8.5
  page.drawText(asunto, {
    x: PAGE_W - MX - fontBold.widthOfTextAtSize(asunto, asuntoSize),
    y: PAGE_H - 42,
    size: asuntoSize,
    font: fontBold,
    color: BLUE,
  })
  page.drawText(datos.ciudadFecha, {
    x: PAGE_W - MX - font.widthOfTextAtSize(datos.ciudadFecha, 8),
    y: PAGE_H - 56,
    size: 8,
    font,
    color: MUTED,
  })

  // Divisor
  const divY = Math.min(logoBottom, PAGE_H - 92) - 16
  page.drawRectangle({
    x: MX,
    y: divY,
    width: CONTENT_W,
    height: 0.75,
    color: BLUE_LINE,
  })

  let y = divY - 36

  // —— Saludo ——
  page.drawText(`SR. (A): ${datos.tutorNombre}`, {
    x: MX,
    y,
    size: 11,
    font: fontBold,
    color: INK,
  })
  y -= 18
  page.drawText('PRESENTE', {
    x: MX,
    y,
    size: 10,
    font: fontBold,
    color: BLUE_DEEP,
  })
  y -= 28

  // —— Intro ——
  const intro =
    nivel === 'secundaria'
      ? `De acuerdo con la solicitud de beca presentada para el ciclo escolar ${datos.cicloLabel}, el Comité de Becas ha resuelto otorgar la BECA de WINSTON con el descuento indicado en colegiaturas al alumno:`
      : `De acuerdo con la solicitud de beca presentada para el ciclo escolar ${datos.cicloLabel}, el Comité de Becas ha resuelto otorgar una beca con el descuento indicado en colegiaturas al alumno:`

  y = drawWrapped(page, intro, MX, y, font, 10, CONTENT_W, 15, INK)
  y -= 26

  // —— Datos ——
  y = drawDatosCard(page, font, fontBold, y, datos)

  // —— Condiciones ——
  y = drawCondiciones(page, font, fontBold, y, datos)
  y -= 18

  // —— Cierre ——
  page.drawText('ATENTAMENTE', {
    x: MX,
    y,
    size: 10,
    font: fontBold,
    color: BLUE_DEEP,
  })
  y -= 22
  page.drawText(datos.comiteLabel, {
    x: MX,
    y,
    size: 10,
    font: fontBold,
    color: INK,
  })

  // —— Firma ——
  const firmaBox: FirmaBox = {
    pageIndex: 0,
    x: PAGE_W - MX - 240,
    y: 78,
    width: 240,
    height: 72,
  }
  page.drawLine({
    start: { x: firmaBox.x + 8, y: firmaBox.y + 22 },
    end: { x: firmaBox.x + firmaBox.width - 8, y: firmaBox.y + 22 },
    thickness: 0.9,
    color: BLUE_DEEP,
  })
  const firmaLabel = 'Fecha y Firma de Enterado'
  page.drawText(firmaLabel, {
    x:
      firmaBox.x +
      (firmaBox.width - font.widthOfTextAtSize(firmaLabel, 8)) / 2,
    y: firmaBox.y + 8,
    size: 8,
    font,
    color: MUTED,
  })

  // —— Footer ——
  page.drawRectangle({
    x: MX,
    y: 52,
    width: CONTENT_W,
    height: 0.6,
    color: BLUE_LINE,
  })
  let fy = 40
  for (const line of meta.direccion) {
    page.drawText(line, {
      x: MX,
      y: fy,
      size: 6.5,
      font,
      color: MUTED,
    })
    fy -= 10
  }

  if (meta.pieVerde) {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_W,
      height: 18,
      color: rgb(0.2, 0.52, 0.28),
    })
    const tag = 'RAISING BRIGHTER KIDS'
    page.drawText(tag, {
      x: (PAGE_W - fontBold.widthOfTextAtSize(tag, 8)) / 2,
      y: 5,
      size: 8,
      font: fontBold,
      color: WHITE,
    })
  } else {
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 3, color: BLUE })
  }

  const bytes = await doc.save()
  return { bytes, firmaBox }
}
