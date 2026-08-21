/**
 * 2026-08-21 - Cartas de aceptación de beca (PDF) por nivel.
 * Diseño unificado: azul marino institucional, fresco y moderno.
 * Logos: maternal/kinder → educativo; primaria/secundaria → W del login.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { DATOS_PRUEBA_POR_NIVEL, type DatosCartaBeca } from './datosPruebaCartas'
import type { FirmaBox, NivelFirma } from './plantillasNivel'

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 48
const CONTENT_W = PAGE_W - MARGIN * 2

/** Azul marino institucional Winston */
const NAVY = rgb(0.04, 0.12, 0.23)
const NAVY_MID = rgb(0.09, 0.22, 0.4)
const NAVY_SOFT = rgb(0.86, 0.91, 0.96)
const SKY = rgb(0.12, 0.45, 0.72)
const INK = rgb(0.11, 0.14, 0.2)
const MUTED = rgb(0.4, 0.45, 0.52)
const WHITE = rgb(1, 1, 1)
const YELLOW = rgb(1, 0.94, 0.55)
const GREEN_FOOT = rgb(0.18, 0.52, 0.28)

const CONDICIONES_BASE = [
  'Presentar buena conducta.',
  'Los padres de familia deberán colaborar directamente en actividades convocadas por el instituto.',
  'Si el pago de colegiaturas no se hiciera en tiempo (dentro de los 10 primeros días naturales del mes) no se hará efectivo el descuento de la beca.',
  'Renovar anualmente la solicitud de beca el mes de Julio.',
]

const LOGO_KINDER = '/logos/logo-winston-educativo.png'
const LOGO_W = '/logos/logo-winston-w.png'

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

/** Marcos diagonales compactos: no invaden el área de texto del ASUNTO. */
function drawMarcosInstitucionales(page: PDFPage) {
  // Franja superior
  page.drawRectangle({ x: 0, y: PAGE_H - 10, width: PAGE_W, height: 10, color: NAVY })
  page.drawRectangle({ x: 0, y: PAGE_H - 14, width: PAGE_W, height: 4, color: SKY })

  // Esquinas superiores pequeñas (máx ~72 px)
  page.drawSvgPath('M 0,0 L 78,0 L 48,28 L 0,36 Z', {
    x: 0,
    y: PAGE_H - 36,
    color: NAVY,
  })
  page.drawSvgPath('M 78,0 L 0,0 L 30,28 L 78,36 Z', {
    x: PAGE_W - 78,
    y: PAGE_H - 36,
    color: NAVY,
  })
  page.drawSvgPath('M 0,0 L 52,0 L 32,16 L 0,22 Z', {
    x: 0,
    y: PAGE_H - 22,
    color: NAVY_MID,
  })
  page.drawSvgPath('M 52,0 L 0,0 L 20,16 L 52,22 Z', {
    x: PAGE_W - 52,
    y: PAGE_H - 22,
    color: NAVY_MID,
  })

  // Esquina inferior izquierda
  page.drawSvgPath('M 0,42 L 70,42 L 42,12 L 0,0 Z', {
    x: 0,
    y: 0,
    color: NAVY,
  })
  page.drawSvgPath('M 0,26 L 48,26 L 28,8 L 0,0 Z', {
    x: 0,
    y: 0,
    color: NAVY_MID,
  })
}

function drawTablaDatos(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  yTop: number,
  datos: DatosCartaBeca
): number {
  const x = MARGIN
  const colW = CONTENT_W / 2
  const rowH = 26
  const pairs: [string, string, string, string][] = [
    ['GRADO A CURSAR', 'NOMBRE DEL ALUMNO', datos.grado, datos.alumnoNombre],
    ['PORCENTAJE', 'TIPO DE BECA', datos.porcentaje, datos.tipoBeca],
  ]

  let y = yTop
  for (const [h1, h2, v1, v2] of pairs) {
    page.drawRectangle({
      x,
      y: y - rowH,
      width: colW,
      height: rowH,
      color: NAVY_SOFT,
      borderColor: NAVY_MID,
      borderWidth: 0.7,
    })
    page.drawRectangle({
      x: x + colW,
      y: y - rowH,
      width: colW,
      height: rowH,
      color: NAVY_SOFT,
      borderColor: NAVY_MID,
      borderWidth: 0.7,
    })
    page.drawText(h1, {
      x: x + 10,
      y: y - 17,
      size: 8,
      font: fontBold,
      color: NAVY,
    })
    page.drawText(h2, {
      x: x + colW + 10,
      y: y - 17,
      size: 8,
      font: fontBold,
      color: NAVY,
    })
    y -= rowH

    page.drawRectangle({
      x,
      y: y - rowH,
      width: colW,
      height: rowH,
      color: YELLOW,
      borderColor: NAVY_MID,
      borderWidth: 0.7,
    })
    page.drawRectangle({
      x: x + colW,
      y: y - rowH,
      width: colW,
      height: rowH,
      color: WHITE,
      borderColor: NAVY_MID,
      borderWidth: 0.7,
    })
    const v1Size = v1.length > 10 ? 11 : 13
    page.drawText(v1, {
      x: x + (colW - fontBold.widthOfTextAtSize(v1, v1Size)) / 2,
      y: y - 18,
      size: v1Size,
      font: fontBold,
      color: NAVY,
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

function drawFirmaArea(
  page: PDFPage,
  font: PDFFont,
  box: FirmaBox,
  align: 'center' | 'right'
): void {
  page.drawLine({
    start: { x: box.x + 12, y: box.y + 24 },
    end: { x: box.x + box.width - 12, y: box.y + 24 },
    thickness: 1.1,
    color: NAVY,
  })
  const label = 'Fecha y Firma de Enterado'
  const lw = font.widthOfTextAtSize(label, 9)
  const lx =
    align === 'center'
      ? box.x + (box.width - lw) / 2
      : box.x + (box.width - lw) / 2
  page.drawText(label, {
    x: lx,
    y: box.y + 8,
    size: 9,
    font,
    color: MUTED,
  })
}

async function drawHeader(
  doc: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  opts: {
    logoUrl: string
    plantelTitulo: string
    plantelSub: string
    asunto?: string
    ciudadFecha?: string
    fechaCarta?: string
    /** Kinder: sin wordmark Winston */
    esKinder: boolean
  }
): Promise<number> {
  drawMarcosInstitucionales(page)

  const logoBytes = await fetchPng(opts.logoUrl)
  if (logoBytes) {
    const logo = await doc.embedPng(logoBytes)
    const maxH = opts.esKinder ? 78 : 62
    const scale = maxH / logo.height
    const w = logo.width * scale
    const h = logo.height * scale
    page.drawImage(logo, {
      x: MARGIN,
      y: PAGE_H - 28 - h,
      width: w,
      height: h,
    })
  }

  const textX = MARGIN + (opts.esKinder ? 88 : 78)
  page.drawText(opts.plantelTitulo, {
    x: textX,
    y: PAGE_H - 48,
    size: 13,
    font: fontBold,
    color: NAVY,
  })
  page.drawText(opts.plantelSub, {
    x: textX,
    y: PAGE_H - 64,
    size: 8,
    font,
    color: MUTED,
  })

  // ASUNTO / fecha alineados a la derecha, fuera de las esquinas (~78 px)
  const rightSafe = PAGE_W - MARGIN
  if (opts.asunto) {
    const size = 9
    const aw = fontBold.widthOfTextAtSize(opts.asunto, size)
    page.drawText(opts.asunto, {
      x: rightSafe - aw,
      y: PAGE_H - 86,
      size,
      font: fontBold,
      color: NAVY,
    })
  }
  if (opts.ciudadFecha) {
    const size = 8
    const cw = font.widthOfTextAtSize(opts.ciudadFecha, size)
    page.drawText(opts.ciudadFecha, {
      x: rightSafe - cw,
      y: PAGE_H - 102,
      size,
      font,
      color: MUTED,
    })
  }
  if (opts.fechaCarta && !opts.ciudadFecha) {
    const size = 9
    const fw = font.widthOfTextAtSize(opts.fechaCarta, size)
    page.drawText(opts.fechaCarta, {
      x: rightSafe - fw,
      y: PAGE_H - 52,
      size,
      font,
      color: INK,
    })
  }

  // Línea divisoria bajo encabezado
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_H - 118,
    width: CONTENT_W,
    height: 2,
    color: NAVY_SOFT,
  })
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_H - 118,
    width: 72,
    height: 2,
    color: SKY,
  })

  return PAGE_H - 138
}

async function crearMaternalKinder(
  doc: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  datos: DatosCartaBeca
): Promise<FirmaBox> {
  let y = await drawHeader(doc, page, font, fontBold, {
    logoUrl: LOGO_KINDER,
    plantelTitulo: 'Instituto Winston Churchill',
    plantelSub: 'Preescolar · Maternal / Kinder',
    fechaCarta: datos.fechaCarta,
    esKinder: true,
  })

  page.drawText(`SR. (A): ${datos.tutorNombre}`, {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: INK,
  })
  y -= 16
  page.drawText('PRESENTE:', {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: NAVY,
  })
  y -= 24

  y = drawWrapped(
    page,
    `De acuerdo a la solicitud de beca presentada para el presente ciclo escolar ${datos.cicloLabel} al Comité de Becas, ha decidido otorgarles la BECA con un descuento aplicado en colegiaturas.`,
    MARGIN,
    y,
    font,
    10,
    CONTENT_W,
    14
  )
  y -= 16

  y = drawTablaDatos(page, font, fontBold, y, datos)
  y -= 14

  page.drawText(
    'El alumno solo puede ser beneficiario de un solo tipo de beca.',
    { x: MARGIN, y, size: 9, font, color: MUTED }
  )
  y -= 16
  page.drawText(
    'Así mismo hacemos de su conocimiento que para conservarla es necesario cumplir con:',
    { x: MARGIN, y, size: 10, font, color: INK }
  )
  y -= 16

  for (const b of [
    `Promedio mínimo Winston de ${datos.promedioMinimo}`,
    ...CONDICIONES_BASE,
  ]) {
    y = drawWrapped(page, `•  ${b}`, MARGIN + 6, y, font, 9.5, CONTENT_W - 12, 13)
    y -= 3
  }

  y -= 12
  page.drawText('ATENTAMENTE', {
    x: (PAGE_W - fontBold.widthOfTextAtSize('ATENTAMENTE', 11)) / 2,
    y,
    size: 11,
    font: fontBold,
    color: NAVY,
  })
  y -= 22
  page.drawText(datos.comiteLabel, {
    x: (PAGE_W - fontBold.widthOfTextAtSize(datos.comiteLabel, 11)) / 2,
    y,
    size: 11,
    font: fontBold,
    color: NAVY,
  })

  const firmaBox: FirmaBox = {
    pageIndex: 0,
    x: 156,
    y: 72,
    width: 300,
    height: 78,
  }
  drawFirmaArea(page, font, firmaBox, 'center')

  page.drawText(
    'PREESCOLAR: Incorporado a la SEP acuerdo No. 9607196 clave 28PJN0213T',
    { x: MARGIN, y: 44, size: 7, font, color: SKY }
  )
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_W,
    height: 26,
    color: GREEN_FOOT,
  })
  page.drawText('RAISING BRIGHTER KIDS', {
    x: (PAGE_W - fontBold.widthOfTextAtSize('RAISING BRIGHTER KIDS', 10)) / 2,
    y: 8,
    size: 10,
    font: fontBold,
    color: WHITE,
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
  let y = await drawHeader(doc, page, font, fontBold, {
    logoUrl: LOGO_W,
    plantelTitulo: 'Instituto Winston Churchill',
    plantelSub:
      nivelLabel === 'PRIMARIA'
        ? 'Primaria · Resolución de beca'
        : 'Secundaria · Resolución de beca',
    asunto: `ASUNTO: RESOLUCIÓN DE BECA ${datos.cicloLabel}`,
    ciudadFecha: datos.ciudadFecha,
    esKinder: false,
  })

  page.drawText(`SR. (A): ${datos.tutorNombre}`, {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: INK,
  })
  y -= 16
  page.drawText('PRESENTE', {
    x: (PAGE_W - fontBold.widthOfTextAtSize('PRESENTE', 11)) / 2,
    y,
    size: 11,
    font: fontBold,
    color: NAVY,
  })
  y -= 22

  const intro =
    nivelLabel === 'SECUNDARIA'
      ? `De acuerdo a la solicitud de beca presentada para el presente ciclo escolar ${datos.cicloLabel} al Comité de Becas, ha decidido otorgarles la BECA de WINSTON con un descuento aplicado en colegiaturas al alumno:`
      : `De acuerdo a la solicitud de beca presentada para el presente ciclo escolar ${datos.cicloLabel} al Comité de Becas, ha decidido otorgarles la BECA con un descuento aplicado en colegiaturas al alumno:`

  y = drawWrapped(page, intro, MARGIN, y, font, 10, CONTENT_W, 14)
  y -= 12
  y = drawTablaDatos(page, font, fontBold, y, datos)
  y -= 14

  page.drawText(
    'Así mismo hacemos de su conocimiento que para conservarla es necesario cumplir con:',
    { x: MARGIN, y, size: 10, font, color: INK }
  )
  y -= 15

  const bullets = [
    `Promedio mínimo Winston de: ${datos.promedioMinimo} (${datos.promedioMinimoLetras})`,
    ...(datos.condicionesExtra || []),
    ...CONDICIONES_BASE,
  ]
  for (const b of bullets) {
    y = drawWrapped(page, `•  ${b}`, MARGIN + 6, y, font, 9.5, CONTENT_W - 14, 12.5)
    y -= 2
  }

  y = Math.min(y - 8, 210)
  page.drawText('ATENTAMENTE', {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: NAVY,
  })
  y -= 28
  page.drawText(datos.comiteLabel, {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: NAVY,
  })

  const firmaBox: FirmaBox = {
    pageIndex: 0,
    x: 300,
    y: 78,
    width: 250,
    height: 82,
  }
  drawFirmaArea(page, font, firmaBox, 'right')

  const dir1 = 'CALLE 3 #309 COL. JARDÍN 20 DE NOVIEMBRE'
  const dir2 = 'CP. 89440 CD. MADERO, TAM  ·  C.C.T.28PES0124J'
  page.drawText(dir1, {
    x: PAGE_W - MARGIN - font.widthOfTextAtSize(dir1, 7),
    y: 38,
    size: 7,
    font,
    color: MUTED,
  })
  page.drawText(dir2, {
    x: PAGE_W - MARGIN - font.widthOfTextAtSize(dir2, 7),
    y: 28,
    size: 7,
    font,
    color: MUTED,
  })

  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 8, color: NAVY })

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
