/**
 * 2026-08-21 - Genera cartas de aceptación de beca (PDF) por nivel.
 * Diseños aproximados a los formatos oficiales; logos desde /public/logos (login).
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { DATOS_PRUEBA_POR_NIVEL, type DatosCartaBeca } from './datosPruebaCartas'
import type { FirmaBox, NivelFirma } from './plantillasNivel'

const PAGE_W = 612
const PAGE_H = 792

const BLUE = rgb(0.05, 0.28, 0.55)
const BLUE_LIGHT = rgb(0.2, 0.45, 0.75)
const RED = rgb(0.78, 0.08, 0.12)
const GREEN_BAR = rgb(0.2, 0.55, 0.22)
const GRAY = rgb(0.35, 0.38, 0.42)
const INK = rgb(0.12, 0.14, 0.18)
const YELLOW = rgb(1, 0.95, 0.55)
const TABLE_HEAD = rgb(0.82, 0.84, 0.86)

const CONDICIONES_BASE = [
  'Presentar buena conducta.',
  'Los padres de familia deberán colaborar directamente en actividades convocadas por el instituto.',
  'Si el pago de colegiaturas no se hiciera en tiempo (dentro de los 10 primeros días naturales del mes) no se hará efectivo el descuento de la beca.',
  'Renovar anualmente la solicitud de beca el mes de Julio.',
]

const LOGO_MATERNAL = '/logos/logo-winston-educativo.png'
const LOGO_IWC = '/logos/logo-winston-churchill.png'
const WORDMARK = '/logos/logo-winston.png'

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

/** Esquinas diagonales azules (estilo primaria/secundaria). */
function drawMarcosAzules(page: PDFPage) {
  const dark = BLUE
  const mid = BLUE_LIGHT
  // Superior izquierda (SVG: origen arriba-izq del bloque)
  page.drawSvgPath('M 0,0 L 155,0 L 95,52 L 0,68 Z', {
    x: 0,
    y: PAGE_H - 68,
    color: dark,
  })
  page.drawSvgPath('M 0,0 L 118,0 L 72,38 L 0,48 Z', {
    x: 0,
    y: PAGE_H - 48,
    color: mid,
  })
  // Superior derecha
  page.drawSvgPath('M 155,0 L 0,0 L 60,52 L 155,68 Z', {
    x: PAGE_W - 155,
    y: PAGE_H - 68,
    color: dark,
  })
  page.drawSvgPath('M 118,0 L 0,0 L 46,38 L 118,48 Z', {
    x: PAGE_W - 118,
    y: PAGE_H - 48,
    color: mid,
  })
  // Inferior izquierda
  page.drawSvgPath('M 0,58 L 130,58 L 75,12 L 0,0 Z', {
    x: 0,
    y: 0,
    color: dark,
  })
  page.drawSvgPath('M 0,38 L 95,38 L 52,8 L 0,0 Z', {
    x: 0,
    y: 0,
    color: mid,
  })
}

function drawTablaResolucion(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  x: number,
  yTop: number,
  datos: DatosCartaBeca
): number {
  const colW = 230
  const rowH = 28
  const rows: [string, string, string, string][] = [
    ['GRADO A CURSAR', 'NOMBRE DEL ALUMNO', datos.grado, datos.alumnoNombre],
    ['PORCENTAJE', 'TIPO DE BECA', datos.porcentaje, datos.tipoBeca],
  ]

  let y = yTop
  for (const [h1, h2, v1, v2] of rows) {
    page.drawRectangle({
      x,
      y: y - rowH,
      width: colW,
      height: rowH,
      color: TABLE_HEAD,
      borderColor: GRAY,
      borderWidth: 0.8,
    })
    page.drawRectangle({
      x: x + colW,
      y: y - rowH,
      width: colW,
      height: rowH,
      color: TABLE_HEAD,
      borderColor: GRAY,
      borderWidth: 0.8,
    })
    page.drawText(h1, {
      x: x + 10,
      y: y - 18,
      size: 9,
      font: fontBold,
      color: INK,
    })
    page.drawText(h2, {
      x: x + colW + 10,
      y: y - 18,
      size: 9,
      font: fontBold,
      color: INK,
    })
    y -= rowH

    page.drawRectangle({
      x,
      y: y - rowH,
      width: colW,
      height: rowH,
      color: YELLOW,
      borderColor: GRAY,
      borderWidth: 0.8,
    })
    page.drawRectangle({
      x: x + colW,
      y: y - rowH,
      width: colW,
      height: rowH,
      color: rgb(1, 1, 1),
      borderColor: GRAY,
      borderWidth: 0.8,
    })
    const v1Size = v1.length > 8 ? 11 : 13
    page.drawText(v1, {
      x: x + (colW - fontBold.widthOfTextAtSize(v1, v1Size)) / 2,
      y: y - 19,
      size: v1Size,
      font: fontBold,
      color: INK,
    })
    const nameSize = v2.length > 28 ? 8 : 10
    const nameLines = wrapText(v2, font, nameSize, colW - 16)
    let ny = y - 14
    for (const line of nameLines.slice(0, 2)) {
      page.drawText(line, {
        x: x + colW + 8,
        y: ny,
        size: nameSize,
        font,
        color: INK,
      })
      ny -= nameSize + 2
    }
    y -= rowH
  }
  return y
}

async function crearMaternalKinder(
  doc: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  datos: DatosCartaBeca
): Promise<FirmaBox> {
  const logoBytes = await fetchPng(LOGO_MATERNAL)
  const wordBytes = await fetchPng(WORDMARK)
  if (logoBytes) {
    const logo = await doc.embedPng(logoBytes)
    page.drawImage(logo, { x: 48, y: PAGE_H - 118, width: 72, height: 90 })
  }
  if (wordBytes) {
    const wm = await doc.embedPng(wordBytes)
    page.drawImage(wm, { x: 140, y: PAGE_H - 88, width: 200, height: 50 })
  } else {
    page.drawText('Winston', {
      x: 150,
      y: PAGE_H - 70,
      size: 28,
      font: fontBold,
      color: RED,
    })
  }

  page.drawText(
    'CALLE 2 #209 COL. JARDÍN 20 DE NOV. CD. MADERO, TAMAULIPAS C.P. 89440',
    { x: 140, y: PAGE_H - 102, size: 7, font, color: BLUE }
  )
  page.drawText('TEL. 362 48 19', {
    x: 140,
    y: PAGE_H - 114,
    size: 7,
    font,
    color: BLUE,
  })
  page.drawText(datos.fechaCarta, {
    x: PAGE_W - 54 - font.widthOfTextAtSize(datos.fechaCarta, 10),
    y: PAGE_H - 70,
    size: 10,
    font,
    color: INK,
  })

  let y = PAGE_H - 155
  page.drawText(`SR. (A): ${datos.tutorNombre}`, {
    x: 54,
    y,
    size: 11,
    font: fontBold,
    color: INK,
  })
  y -= 16
  page.drawText('PRESENTE:', { x: 54, y, size: 11, font: fontBold, color: INK })
  y -= 28

  y = drawWrapped(
    page,
    `De acuerdo a la solicitud de beca presentada para el presente ciclo escolar ${datos.cicloLabel} al Comité de Becas al Alumno (a), ha decidido otorgarles la BECA con un descuento aplicado en colegiaturas.`,
    54,
    y,
    font,
    10,
    PAGE_W - 108,
    14
  )
  y -= 18

  page.drawText(`NOMBRE: ${datos.alumnoNombre}`, {
    x: 54,
    y,
    size: 11,
    font: fontBold,
    color: INK,
  })
  page.drawText(`GRADO: ${datos.grado}`, {
    x: 400,
    y,
    size: 11,
    font: fontBold,
    color: INK,
  })
  y -= 18
  page.drawText(`TIPO DE BECA: ${datos.tipoBeca}`, {
    x: 54,
    y,
    size: 11,
    font: fontBold,
    color: INK,
  })
  page.drawText(`PORCENTAJE: ${datos.porcentaje}`, {
    x: 400,
    y,
    size: 11,
    font: fontBold,
    color: INK,
  })
  y -= 22

  page.drawText('El alumno solo puede ser beneficiario de un solo tipo de beca.', {
    x: 54,
    y,
    size: 10,
    font,
    color: INK,
  })
  y -= 20
  page.drawText(
    'Así mismo hacemos de su conocimiento que para conservarla es necesario cumplir con:',
    { x: 54, y, size: 10, font, color: INK }
  )
  y -= 18

  const bullets = [
    `Promedio mínimo Winston de ${datos.promedioMinimo}`,
    ...CONDICIONES_BASE,
  ]
  for (const b of bullets) {
    y = drawWrapped(page, `> ${b}`, 62, y, font, 10, PAGE_W - 120, 13)
    y -= 4
  }

  y -= 16
  page.drawText('ATENTAMENTE', {
    x: (PAGE_W - fontBold.widthOfTextAtSize('ATENTAMENTE', 11)) / 2,
    y,
    size: 11,
    font: fontBold,
    color: INK,
  })
  y -= 28
  page.drawText(datos.comiteLabel, {
    x: (PAGE_W - fontBold.widthOfTextAtSize(datos.comiteLabel, 12)) / 2,
    y,
    size: 12,
    font: fontBold,
    color: INK,
  })

  const firmaBox: FirmaBox = {
    pageIndex: 0,
    x: 156,
    y: 78,
    width: 300,
    height: 78,
  }
  page.drawLine({
    start: { x: firmaBox.x + 20, y: firmaBox.y + 22 },
    end: { x: firmaBox.x + firmaBox.width - 20, y: firmaBox.y + 22 },
    thickness: 1,
    color: INK,
  })
  const label = 'Fecha y Firma de Enterado'
  page.drawText(label, {
    x: (PAGE_W - font.widthOfTextAtSize(label, 9)) / 2,
    y: firmaBox.y + 6,
    size: 9,
    font,
    color: GRAY,
  })

  page.drawText(
    'PREESCOLAR: Incorporado a la SEP acuerdo No. 9607196 clave 28PJN0213T',
    { x: 54, y: 48, size: 7, font, color: BLUE }
  )
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_W,
    height: 28,
    color: GREEN_BAR,
  })
  page.drawText('RAISING BRIGHTER KIDS', {
    x: (PAGE_W - fontBold.widthOfTextAtSize('RAISING BRIGHTER KIDS', 11)) / 2,
    y: 9,
    size: 11,
    font: fontBold,
    color: rgb(1, 1, 1),
  })

  return firmaBox
}

async function crearResolucionNivel(
  doc: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  datos: DatosCartaBeca,
  nivelLabel: 'PRIMARIA' | 'SECUNDARIA'
): Promise<FirmaBox> {
  drawMarcosAzules(page)

  const logoBytes = await fetchPng(LOGO_IWC)
  if (logoBytes) {
    const logo = await doc.embedPng(logoBytes)
    page.drawImage(logo, { x: 42, y: PAGE_H - 128, width: 70, height: 90 })
  }

  const asunto = `ASUNTO: RESOLUCIÓN DE BECA ${datos.cicloLabel}`
  page.drawText(asunto, {
    x: PAGE_W - 54 - fontBold.widthOfTextAtSize(asunto, 10),
    y: PAGE_H - 58,
    size: 10,
    font: fontBold,
    color: INK,
  })
  page.drawText(datos.ciudadFecha, {
    x: PAGE_W - 54 - font.widthOfTextAtSize(datos.ciudadFecha, 9),
    y: PAGE_H - 74,
    size: 9,
    font,
    color: INK,
  })

  let y = PAGE_H - 155
  page.drawText(`SR. (A): ${datos.tutorNombre}`, {
    x: 54,
    y,
    size: 11,
    font: fontBold,
    color: INK,
  })
  y -= 18
  page.drawText('PRESENTE', {
    x: (PAGE_W - fontBold.widthOfTextAtSize('PRESENTE', 11)) / 2,
    y,
    size: 11,
    font: fontBold,
    color: INK,
  })
  y -= 26

  const intro =
    nivelLabel === 'SECUNDARIA'
      ? `De acuerdo a la solicitud de beca presentada para el presente ciclo escolar ${datos.cicloLabel} al Comité de Becas, ha decidido otorgarles la BECA de WINSTON con un descuento aplicado en colegiaturas al alumno:`
      : `De acuerdo a la solicitud de beca presentada para el presente ciclo escolar ${datos.cicloLabel} al Comité de Becas, ha decidido otorgarles la BECA con un descuento aplicado en colegiaturas al alumno:`

  y = drawWrapped(page, intro, 54, y, font, 10, PAGE_W - 108, 14)
  y -= 14

  y = drawTablaResolucion(page, font, fontBold, 76, y, datos)
  y -= 18

  page.drawText(
    'Así mismo hacemos de su conocimiento que para conservarla es necesario cumplir con:',
    { x: 54, y, size: 10, font, color: INK }
  )
  y -= 16

  const bullets = [
    `Promedio mínimo Winston de: ${datos.promedioMinimo} (${datos.promedioMinimoLetras})`,
    ...(datos.condicionesExtra || []),
    ...CONDICIONES_BASE,
  ]
  for (const b of bullets) {
    y = drawWrapped(page, `> ${b}`, 62, y, font, 9.5, PAGE_W - 130, 12.5)
    y -= 3
  }

  y = Math.min(y, 220)
  y -= 10
  page.drawText('ATENTAMENTE', {
    x: 54,
    y,
    size: 11,
    font: fontBold,
    color: INK,
  })
  y -= 36
  page.drawText(datos.comiteLabel, {
    x: 54,
    y,
    size: 11,
    font: fontBold,
    color: INK,
  })

  const firmaBox: FirmaBox = {
    pageIndex: 0,
    x: 300,
    y: 88,
    width: 250,
    height: 82,
  }
  page.drawLine({
    start: { x: firmaBox.x + 10, y: firmaBox.y + 24 },
    end: { x: firmaBox.x + firmaBox.width - 10, y: firmaBox.y + 24 },
    thickness: 1,
    color: INK,
  })
  const label = 'Fecha y Firma de Enterado'
  page.drawText(label, {
    x: firmaBox.x + (firmaBox.width - font.widthOfTextAtSize(label, 9)) / 2,
    y: firmaBox.y + 8,
    size: 9,
    font,
    color: GRAY,
  })

  const dir1 = 'CALLE 3 #309 COL. JARDÍN 20 DE NOVIEMBRE'
  const dir2 = 'CP. 89440 CD. MADERO, TAM'
  const dir3 = 'C.C.T.28PES0124J'
  page.drawText(dir1, {
    x: PAGE_W - 54 - font.widthOfTextAtSize(dir1, 7),
    y: 42,
    size: 7,
    font,
    color: GRAY,
  })
  page.drawText(dir2, {
    x: PAGE_W - 54 - font.widthOfTextAtSize(dir2, 7),
    y: 32,
    size: 7,
    font,
    color: GRAY,
  })
  page.drawText(dir3, {
    x: PAGE_W - 54 - font.widthOfTextAtSize(dir3, 7),
    y: 22,
    size: 7,
    font,
    color: GRAY,
  })

  return firmaBox
}

/** Genera el PDF de prueba del nivel seleccionado. */
export async function crearCartaBecaPdf(
  nivel: NivelFirma,
  datosOverride?: Partial<DatosCartaBeca>
): Promise<CartaGenerada> {
  const datos: DatosCartaBeca = {
    ...DATOS_PRUEBA_POR_NIVEL[nivel],
    ...datosOverride,
  }

  const doc = await PDFDocument.create()
  const page = doc.addPage([PAGE_W, PAGE_H])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  let firmaBox: FirmaBox
  if (nivel === 'maternal-kinder') {
    firmaBox = await crearMaternalKinder(doc, page, font, fontBold, datos)
  } else if (nivel === 'primaria') {
    firmaBox = await crearResolucionNivel(
      doc,
      page,
      font,
      fontBold,
      datos,
      'PRIMARIA'
    )
  } else {
    firmaBox = await crearResolucionNivel(
      doc,
      page,
      font,
      fontBold,
      datos,
      'SECUNDARIA'
    )
  }

  const bytes = await doc.save()
  return { bytes, firmaBox }
}
