/**
 * Carta de Resolución y Condiciones de Beca (texto oficial, 3 niveles).
 * Ciclo y fecha se resuelven al generar (temporada actual), no como valor fijo permanente.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import {
  datosCartaParaPdf,
  tipoBecaCompleto,
  type DatosCartaBeca,
} from './datosPruebaCartas'
import type { FirmaBox, NivelFirma } from './plantillasNivel'

const PAGE_W = 612
const PAGE_H = 792
const MX = 54
const CONTENT_W = PAGE_W - MX * 2
const TOP = PAGE_H - 36
const BOTTOM = 48

const BLUE = rgb(0.0, 0.34, 0.68)
const BLUE_DEEP = rgb(0.04, 0.16, 0.32)
const BLUE_LINE = rgb(0.55, 0.65, 0.78)
const GREEN = rgb(0.55, 0.78, 0.25)
const INK = rgb(0.12, 0.14, 0.18)
const MUTED = rgb(0.28, 0.32, 0.38)
const FOOT = rgb(0.18, 0.22, 0.28)
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

export type CartaGenerada = {
  bytes: Uint8Array
  firmaBox: FirmaBox
}

async function fetchPng(
  url: string,
  assetsBaseUrl?: string
): Promise<Uint8Array | null> {
  try {
    const abs = url.startsWith('http')
      ? url
      : `${(assetsBaseUrl ?? '').replace(/\/$/, '')}${url}`
    const res = await fetch(abs)
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

export async function crearCartaBecaPdf(
  nivel: NivelFirma,
  datosOverride?: Partial<DatosCartaBeca>,
  opts?: { assetsBaseUrl?: string }
): Promise<CartaGenerada> {
  const datos = datosCartaParaPdf(nivel, datosOverride)
  const meta = META_NIVEL[nivel]
  const assetsBaseUrl = opts?.assetsBaseUrl
  const ciclo = datos.cicloLabel
  const tipo = tipoBecaCompleto(datos.tipoBeca, datos.porcentaje)

  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  let page = doc.addPage([PAGE_W, PAGE_H])
  let y = TOP
  let pageIndex = 0

  const footer = (p: PDFPage) => {
    p.drawRectangle({ x: MX, y: 36, width: CONTENT_W, height: 0.6, color: BLUE_LINE })
    p.drawText(meta.direccion[0] ?? '', {
      x: MX,
      y: 24,
      size: 6.5,
      font,
      color: FOOT,
    })
    if (meta.direccion[1]) {
      p.drawText(meta.direccion[1], { x: MX, y: 14, size: 6.5, font, color: FOOT })
    }
  }

  const newPage = () => {
    footer(page)
    page = doc.addPage([PAGE_W, PAGE_H])
    pageIndex += 1
    y = TOP
    page.drawRectangle({ x: 0, y: PAGE_H - 3, width: PAGE_W, height: 3, color: BLUE })
  }

  const need = (h: number) => {
    if (y - h < BOTTOM + 8) newPage()
  }

  const text = (s: string, size: number, bold = false, color = INK) => {
    need(size + 4)
    page.drawText(s, { x: MX, y, size, font: bold ? fontBold : font, color })
    y -= size + 6
  }

  const para = (s: string, size = 9.5, leading = 13, bold = false) => {
    const f = bold ? fontBold : font
    const lines = wrapText(s, f, size, CONTENT_W)
    for (const line of lines) {
      need(leading)
      page.drawText(line, { x: MX, y, size, font: f, color: INK })
      y -= leading
    }
    y -= 4
  }

  const heading = (s: string) => {
    y -= 6
    need(22)
    page.drawText(s, { x: MX, y, size: 10, font: fontBold, color: BLUE_DEEP })
    y -= 4
    page.drawRectangle({ x: MX, y: y - 1, width: 52, height: 1.4, color: BLUE })
    y -= 16
  }

  const fieldLine = (label: string, value: string) => {
    need(18)
    page.drawText(label, { x: MX, y, size: 9.5, font: fontBold, color: INK })
    const lx = MX + fontBold.widthOfTextAtSize(label, 9.5) + 8
    page.drawText(value, { x: lx, y, size: 9.5, font: fontBold, color: BLUE_DEEP })
    page.drawLine({
      start: { x: lx, y: y - 2 },
      end: { x: MX + CONTENT_W, y: y - 2 },
      thickness: 0.6,
      color: BLUE_LINE,
    })
    y -= 18
  }

  // —— Encabezado institucional (solo p.1) ——
  page.drawRectangle({ x: 0, y: PAGE_H - 4, width: PAGE_W, height: 4, color: BLUE })
  page.drawRectangle({ x: 0, y: PAGE_H - 6, width: 96, height: 2, color: GREEN })

  const logoBytes = await fetchPng(meta.logoUrl, assetsBaseUrl)
  if (logoBytes) {
    const logo = await doc.embedPng(logoBytes)
    const maxH = nivel === 'maternal-kinder' ? 56 : 46
    const scale = maxH / logo.height
    const w = logo.width * scale
    const h = logo.height * scale
    page.drawImage(logo, { x: MX, y: PAGE_H - 20 - h, width: w, height: h })
  }

  const headX = MX + (nivel === 'maternal-kinder' ? 78 : 68)
  page.drawText('Instituto Winston Churchill', {
    x: headX,
    y: PAGE_H - 40,
    size: 12,
    font: fontBold,
    color: BLUE_DEEP,
  })
  page.drawText(meta.nivelLabel, {
    x: headX,
    y: PAGE_H - 54,
    size: 9,
    font,
    color: MUTED,
  })
  const cicloHead = `Ciclo Escolar ${ciclo}`
  page.drawText(cicloHead, {
    x: PAGE_W - MX - fontBold.widthOfTextAtSize(cicloHead, 9),
    y: PAGE_H - 40,
    size: 9,
    font: fontBold,
    color: BLUE,
  })
  page.drawText(datos.ciudadFecha, {
    x: PAGE_W - MX - font.widthOfTextAtSize(datos.ciudadFecha, 8),
    y: PAGE_H - 54,
    size: 8,
    font,
    color: MUTED,
  })

  y = PAGE_H - 98
  page.drawRectangle({ x: MX, y, width: CONTENT_W, height: 0.75, color: BLUE_LINE })
  y -= 22

  page.drawText(datos.fechaCarta, {
    x: PAGE_W - MX - font.widthOfTextAtSize(datos.fechaCarta, 9),
    y,
    size: 9,
    font,
    color: MUTED,
  })
  y -= 20

  const titulo = 'CARTA DE RESOLUCIÓN Y CONDICIONES DE BECA'
  page.drawText(titulo, {
    x: MX + (CONTENT_W - fontBold.widthOfTextAtSize(titulo, 11.5)) / 2,
    y,
    size: 11.5,
    font: fontBold,
    color: BLUE_DEEP,
  })
  y -= 18
  const sub = `Ciclo Escolar ${ciclo}`
  page.drawText(sub, {
    x: MX + (CONTENT_W - fontBold.widthOfTextAtSize(sub, 10)) / 2,
    y,
    size: 10,
    font: fontBold,
    color: BLUE,
  })
  y -= 22

  text('SR.(A) PADRE, MADRE O TUTOR(A)', 10, true)
  text('P R E S E N T E', 10, true, BLUE_DEEP)
  y -= 4

  para(
    `Por medio de la presente, y en atención a la solicitud de beca presentada para el Ciclo Escolar ${ciclo}, nos permitimos informarle que el Comité de Becas, después de realizar la revisión y evaluación correspondiente, ha determinado otorgar al alumno(a) el beneficio de beca que se señala a continuación:`
  )

  heading('DATOS DEL ALUMNO(A)')
  fieldLine('Nombre del alumno(a):', datos.alumnoNombre)
  fieldLine('Grado:', datos.grado)
  fieldLine('Tipo de beca:', tipo)
  y -= 6

  heading('CONDICIÓN ACADÉMICA DE LA BECA')
  para(
    'La beca otorgada se encuentra sujeta al cumplimiento del promedio mínimo establecido para el tipo de beneficio autorizado:'
  )
  need(28)
  page.drawText('PROMEDIO MÍNIMO REQUERIDO PARA CONSERVAR LA BECA', {
    x: MX,
    y,
    size: 9.5,
    font: fontBold,
    color: INK,
  })
  y -= 16
  page.drawText(`${datos.promedioMinimo}  (${datos.promedioMinimoLetras})`, {
    x: MX,
    y,
    size: 12,
    font: fontBold,
    color: BLUE,
  })
  y -= 18
  para(
    'El promedio mínimo señalado deberá cumplirse al fin del ciclo escolar, de acuerdo con los criterios de evaluación establecidos por la institución y/o con las condiciones particulares correspondientes al tipo de beca otorgada.'
  )

  heading('NATURALEZA Y ALCANCE DEL BENEFICIO')
  para(
    `La beca constituye un beneficio económico condicionado, otorgado exclusivamente para el Ciclo Escolar ${ciclo}, y se conservará únicamente mientras el alumno(a) y su padre, madre o tutor(a) cumplan con las condiciones establecidas en la presente carta, así como con las disposiciones contenidas en el Reglamento Escolar y demás normatividad institucional aplicable.`
  )
  para(
    'El beneficio de beca aplica exclusivamente sobre el concepto de colegiatura y no comprende otros conceptos, servicios, cuotas, materiales, actividades, eventos, inscripciones, reinscripciones o cualquier otro cargo distinto a la colegiatura.'
  )
  para(
    'La beca no es acumulable con otros descuentos, promociones, beneficios o apoyos económicos.'
  )

  heading('CONDICIONES PARA CONSERVAR LA BECA')
  para(
    'Para conservar el beneficio durante el ciclo escolar, deberán cumplirse de manera continua las siguientes condiciones:'
  )
  para('1. Rendimiento académico.', 9.5, 13, true)
  para(
    'El alumno(a) deberá cumplir con el promedio establecido para el tipo de beca otorgada.'
  )
  para('2. Conducta y disciplina.', 9.5, 13, true)
  para(
    'El alumno(a) deberá cumplir con las disposiciones establecidas en el Reglamento Escolar, evitando la acumulación de reportes y/o suspensiones disciplinarias graves y/o reincidencias que, de acuerdo con dicho reglamento, puedan constituir una causa para la suspensión o cancelación del beneficio.'
  )
  para('3. Cumplimiento de los padres de familia o tutores.', 9.5, 13, true)
  para('El padre, madre o tutor(a) se compromete a:')
  para(
    'a) Atender oportunamente las reuniones, citatorios, convocatorias institucionales y demás comunicaciones relacionadas con el seguimiento académico, conductual y formativo del alumno(a).'
  )
  para(
    'b) Mantener una disposición activa de participación y colaboración, atendiendo de manera responsable las convocatorias institucionales para actividades escolares, eventos, proyectos y demás acciones que requieran la participación de las familias, evitando la negativa reiterada e injustificada a participar cuando sea convocado(a).'
  )
  para(
    'c) Colaborar, cuando la institución lo solicite, con el equipo de representantes de padres de familia, dentro de las responsabilidades correspondientes a dicha participación.'
  )
  para(
    'd) Conducirse en todo momento con respeto, cordialidad y disposición de colaboración hacia alumnos, familias, docentes, directivos y personal de la institución, contribuyendo a un ambiente de sana convivencia. No se consideran compatibles con este compromiso las conductas de falta de respeto, confrontación, descalificación, agresión verbal o cualquier otra que afecte la convivencia o el adecuado desarrollo de las actividades institucionales.'
  )
  para(
    'e) Respetar y colaborar con las disposiciones de vialidad y seguridad establecidas por la institución, incluyendo las indicaciones del personal encargado del acceso, ascenso y descenso de alumnos, circulación vehicular y estacionamiento.'
  )
  para('4. Pago oportuno de colegiaturas.', 9.5, 13, true)
  para(
    'Las colegiaturas deberán ser cubiertas dentro de los primeros 10 días naturales de cada mes. En caso de que el pago no se realice dentro de dicho periodo, el beneficio de beca no será aplicado en la mensualidad correspondiente.'
  )
  para(
    'El beneficio podrá retomarse en la mensualidad siguiente, siempre que se encuentren cumplidas las demás condiciones de conservación de la beca y no se haya actualizado alguna de las causas de cancelación señaladas en la presente carta. La reincidencia en el incumplimiento de los pagos podrá ser considerada como causa de cancelación definitiva del beneficio, de conformidad con las disposiciones y criterios establecidos por la institución.'
  )

  heading('CAUSAS DE CANCELACIÓN DE LA BECA')
  para(
    'El beneficio podrá ser cancelado de manera temporal o definitiva, según la gravedad y/o reincidencia del incumplimiento, cuando se presente cualquiera de las siguientes situaciones:'
  )
  para(
    'A. Incumplimiento de cualquiera de las condiciones establecidas en los numerales 1, 2, 3 y 4 de la presente carta.'
  )
  para(
    'B. Falsedad, omisión o alteración de información o documentación proporcionada durante el proceso de solicitud, renovación o evaluación de la beca.'
  )
  para(
    'La determinación de una cancelación definitiva será realizada por la institución, considerando la naturaleza, gravedad y/o reincidencia del incumplimiento correspondiente.'
  )

  heading('RENOVACIÓN DE LA BECA')
  para(
    `La beca otorgada mediante la presente resolución corresponde única y exclusivamente al Ciclo Escolar ${ciclo}. La beca no constituye un beneficio permanente ni genera y/o garantiza un derecho automático de renovación para ciclos escolares posteriores.`
  )
  para(
    'En caso de que el padre, madre o tutor(a) desee solicitar nuevamente este beneficio, deberá presentar una nueva solicitud de beca durante el periodo establecido por la institución, sujetándose al proceso de revisión, evaluación, requisitos y disponibilidad de becas correspondiente al nuevo ciclo escolar.'
  )

  const clausulaSeguimiento = String(datos.clausulaSeguimientoTexto || '').trim()
  if (datos.seguimientoIndividualizado && clausulaSeguimiento) {
    heading('SEGUIMIENTO INDIVIDUALIZADO')
    para(clausulaSeguimiento)
  }

  heading('ACEPTACIÓN Y CONOCIMIENTO DE LAS CONDICIONES')
  para(
    'Con la firma electrónica de la presente carta, el padre, madre o tutor(a) manifiesta haber leído y comprendido las condiciones bajo las cuales se otorga el beneficio de beca, así como su carácter condicionado, temporal y sujeto a cumplimiento.'
  )
  para(
    'Asimismo, manifiesta su conformidad con que el incumplimiento de las condiciones establecidas podrá dar lugar a la no aplicación del beneficio en la mensualidad correspondiente o, en los casos previstos, a su cancelación definitiva.'
  )

  y -= 4
  text('ATENTAMENTE', 10, true, BLUE_DEEP)
  text('C O M I T É   D E   B E C A S', 10, true)

  heading('FIRMA ELECTRÓNICA')
  para(
    'El padre, madre o tutor(a) deberá capturar su nombre completo y su firma electrónica en el apartado correspondiente. El nombre se imprimirá debajo de la línea de firma.'
  )

  need(108)
  const firmaBox: FirmaBox = {
    pageIndex,
    x: MX,
    y: y - 86,
    width: 280,
    height: 86,
    fechaCenterX: 0,
    fechaValorY: 0,
    fechaLabelY: 0,
    nombreY: 0,
    nombreMaxWidth: 260,
  }
  page.drawRectangle({
    x: firmaBox.x,
    y: firmaBox.y,
    width: firmaBox.width,
    height: firmaBox.height,
    borderColor: BLUE_LINE,
    borderWidth: 1,
    color: rgb(0.97, 0.98, 0.99),
  })
  page.drawText('Espacio de firma electrónica', {
    x: firmaBox.x + 10,
    y: firmaBox.y + firmaBox.height - 14,
    size: 8,
    font,
    color: MUTED,
  })
  const lineY = firmaBox.y + 28
  page.drawLine({
    start: { x: firmaBox.x + 16, y: lineY },
    end: { x: firmaBox.x + firmaBox.width - 16, y: lineY },
    thickness: 0.8,
    color: BLUE_LINE,
  })
  firmaBox.nombreY = lineY - 14
  firmaBox.nombreMaxWidth = firmaBox.width - 32
  page.drawText('Nombre del padre, madre o tutor(a)', {
    x: firmaBox.x + 16,
    y: firmaBox.y + 8,
    size: 7,
    font,
    color: MUTED,
  })
  const fechaColLeft = firmaBox.x + 290
  const fechaColRight = MX + CONTENT_W
  const fechaColCenter = (fechaColLeft + fechaColRight) / 2
  page.drawLine({
    start: { x: fechaColLeft, y: lineY },
    end: { x: fechaColRight, y: lineY },
    thickness: 0.6,
    color: BLUE_LINE,
  })
  firmaBox.fechaCenterX = fechaColCenter
  firmaBox.fechaValorY = lineY - 12
  firmaBox.fechaLabelY = lineY - 26
  const fechaLabel = 'FECHA DE FIRMA'
  const fechaLabelSize = 7.5
  const fechaLabelW = fontBold.widthOfTextAtSize(fechaLabel, fechaLabelSize)
  page.drawText(fechaLabel, {
    x: fechaColCenter - fechaLabelW / 2,
    y: firmaBox.fechaLabelY,
    size: fechaLabelSize,
    font: fontBold,
    color: MUTED,
  })

  y = firmaBox.y - 16
  footer(page)

  if (meta.pieVerde) {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_W,
      height: 12,
      color: rgb(0.2, 0.52, 0.28),
    })
    const tag = 'RAISING BRIGHTER KIDS'
    page.drawText(tag, {
      x: (PAGE_W - fontBold.widthOfTextAtSize(tag, 7)) / 2,
      y: 3,
      size: 7,
      font: fontBold,
      color: WHITE,
    })
  }

  const bytes = await doc.save()
  return { bytes, firmaBox }
}
