import fs from 'fs'
import path from 'path'
import jsPDF from 'jspdf'
import { etiquetaCicloEscolar } from './cicloEscolar'
import {
  formatearFechaBoucher,
  formatearMonedaBoucher,
  getClient,
  getEmitter,
  getFullLevel,
  getPaymentConcept,
  gradoPdfBoucher,
  normalizarConceptoNo,
} from './boucherCore'

export interface DatosPdfBoucher {
  nombreAlumno: string
  alumnoNivel: number
  alumnoGrado: number
  conceptoNo: string
  conceptoClase?: string
  referencia: string
  importe: number
  vigencia: string
  cicloEscolar: number
  aplicarRecargos: boolean
  ignorarMesPago: boolean
}

const PAGE_W = 215.9
const MARGIN = 14
const CONTENT_W = PAGE_W - MARGIN * 2

const C = {
  navy: [8, 28, 52] as const,
  navyMid: [14, 50, 86] as const,
  cyan: [34, 211, 238] as const,
  gold: [245, 158, 11] as const,
  goldDark: [180, 120, 8] as const,
  white: [255, 255, 255] as const,
  slate50: [248, 250, 252] as const,
  slate100: [241, 245, 249] as const,
  slate200: [226, 232, 240] as const,
  slate500: [100, 116, 139] as const,
  slate700: [51, 65, 85] as const,
  slate900: [15, 23, 42] as const,
  redSoft: [254, 242, 242] as const,
  redText: [185, 28, 28] as const,
}

function setFill(pdf: jsPDF, rgb: readonly [number, number, number]) {
  pdf.setFillColor(rgb[0], rgb[1], rgb[2])
}

function setText(pdf: jsPDF, rgb: readonly [number, number, number]) {
  pdf.setTextColor(rgb[0], rgb[1], rgb[2])
}

function setDraw(pdf: jsPDF, rgb: readonly [number, number, number]) {
  pdf.setDrawColor(rgb[0], rgb[1], rgb[2])
}

function logoDataUrl(nivel: number): { data: string; w: number; h: number } | null {
  const file = nivel < 3 ? 'educativo.png' : 'logo_full.png'
  const full = path.join(process.cwd(), 'public', 'bauchers', file)
  if (!fs.existsSync(full)) return null
  const buf = fs.readFileSync(full)
  const data = `data:image/png;base64,${buf.toString('base64')}`
  return nivel < 3 ? { data, w: 42, h: 10 } : { data, w: 38, h: 14 }
}

function dibujarEncabezado(
  pdf: jsPDF,
  datos: DatosPdfBoucher,
  grado: number,
  logo: { data: string; w: number; h: number } | null
): number {
  const headerH = 44
  setFill(pdf, C.navy)
  pdf.rect(0, 0, PAGE_W, headerH, 'F')
  setFill(pdf, C.cyan)
  pdf.rect(0, headerH - 2.5, PAGE_W, 2.5, 'F')

  const logoX = MARGIN
  const logoY = 9
  if (logo) {
    try {
      pdf.addImage(logo.data, 'PNG', logoX, logoY, logo.w, logo.h)
    } catch {
      /* logo opcional */
    }
  }

  const textX = logo ? logoX + logo.w + 6 : MARGIN
  setText(pdf, C.white)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.text('Instituto Winston Churchill', textX, 16)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text('Comprobante de pago en ventanilla', textX, 22)

  const cicloEtiqueta = etiquetaCicloEscolar(datos.cicloEscolar)
  const badgeW = 52
  const badgeX = PAGE_W - MARGIN - badgeW
  setFill(pdf, C.navyMid)
  pdf.roundedRect(badgeX, 10, badgeW, 16, 2, 2, 'F')
  setText(pdf, C.cyan)
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'bold')
  pdf.text('CICLO ESCOLAR', badgeX + badgeW / 2, 15, { align: 'center' })
  setText(pdf, C.white)
  pdf.setFontSize(9)
  pdf.text(cicloEtiqueta, badgeX + badgeW / 2, 21, { align: 'center' })

  return headerH + 8
}

function dibujarTarjetaReferencia(
  pdf: jsPDF,
  referencia: string,
  importe: number,
  concepto: string,
  y: number
): number {
  const cardH = 36
  setFill(pdf, C.slate50)
  setDraw(pdf, C.slate200)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(MARGIN, y, CONTENT_W, cardH, 3, 3, 'FD')

  setFill(pdf, C.navy)
  pdf.roundedRect(MARGIN, y, CONTENT_W, 10, 3, 3, 'F')
  pdf.rect(MARGIN, y + 5, CONTENT_W, 5, 'F')
  setText(pdf, C.white)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text(concepto, MARGIN + 5, y + 7)

  const midY = y + 14
  setText(pdf, C.slate500)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text('REFERENCIA DE PAGO', MARGIN + 5, midY + 4)

  setText(pdf, C.slate900)
  pdf.setFont('courier', 'bold')
  pdf.setFontSize(14)
  pdf.text(referencia, MARGIN + 5, midY + 12)

  const importeX = PAGE_W - MARGIN - 5
  setText(pdf, C.slate500)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text('IMPORTE A PAGAR', importeX, midY + 4, { align: 'right' })

  setText(pdf, C.goldDark)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text(formatearMonedaBoucher(importe), importeX, midY + 13, { align: 'right' })

  return y + cardH + 8
}

function dibujarFilaDetalle(
  pdf: jsPDF,
  etiqueta: string,
  valor: string,
  x: number,
  y: number,
  ancho: number
): number {
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9.5)
  const lines = pdf.splitTextToSize(valor, ancho - 6)
  const rowH = 9 + lines.length * 4.2

  setFill(pdf, C.white)
  setDraw(pdf, C.slate200)
  pdf.setLineWidth(0.2)
  pdf.roundedRect(x, y, ancho, rowH, 1.5, 1.5, 'D')

  setText(pdf, C.slate500)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  pdf.text(etiqueta.toUpperCase(), x + 3, y + 4.2)

  setText(pdf, C.slate900)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9.5)
  pdf.text(lines, x + 3, y + 8.5)

  return rowH
}

function dibujarSeccionAlumno(
  pdf: jsPDF,
  nombre: string,
  nivelGrado: string,
  y: number
): number {
  const blockH = 22
  setFill(pdf, C.navyMid)
  pdf.roundedRect(MARGIN, y, CONTENT_W, blockH, 2.5, 2.5, 'F')
  setText(pdf, C.cyan)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.text('ALUMNO', MARGIN + 5, y + 6)
  setText(pdf, C.white)
  pdf.setFontSize(12)
  const nombreLines = pdf.splitTextToSize(nombre, CONTENT_W - 10)
  pdf.text(nombreLines, MARGIN + 5, y + 13)
  setText(pdf, C.slate200)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(nivelGrado, MARGIN + 5, y + 19)
  return y + blockH + 6
}

function dibujarAvisoLegal(
  pdf: jsPDF,
  datos: DatosPdfBoucher,
  y: number
): number {
  let avisoH = 18
  const avisos: string[] = []

  if (normalizarConceptoNo(datos.conceptoNo) === '00') {
    avisos.push(
      `Cuota de Inicio de Curso: la fecha límite de pago es el ${formatearFechaBoucher(datos.vigencia)}. No aplicar recargos bancarios antes de esa fecha.`
    )
  } else {
    avisos.push(
      `Validez del comprobante: ${formatearFechaBoucher(datos.vigencia)}. Colegiaturas: del 1 al 10 de cada mes; si se genera después del día 10, la validez es de 7 días. En ventanilla no aplicar recargo de $75 (solo comercio electrónico / Openpay). La beca Winston no aplica después del día 10.`
    )
  }

  if (datos.aplicarRecargos) {
    avisos.push(
      'El pago de colegiaturas es del 1 al 10 de cada mes (días naturales). A partir del día 11 se aplicará recargo de $75.00 por mes hasta su liquidación. La beca Winston no aplica después del día 10; la beca SEP se respeta y solo suma recargos.'
    )
  }

  avisos.push(
    'Este comprobante es válido únicamente para pago en ventanilla Banorte. No debe llenarse a mano; el banco no autoriza ese movimiento.'
  )

  const texto = avisos.join(' ')
  const lines = pdf.splitTextToSize(texto, CONTENT_W - 10)
  avisoH = 10 + lines.length * 4.2

  setFill(pdf, C.redSoft)
  setDraw(pdf, C.redText)
  pdf.setLineWidth(0.25)
  pdf.roundedRect(MARGIN, y, CONTENT_W, avisoH, 2, 2, 'FD')

  setText(pdf, C.redText)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7.5)
  pdf.text('IMPORTANTE', MARGIN + 4, y + 5.5)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text(lines, MARGIN + 4, y + 10)

  return y + avisoH + 4
}

function dibujarPie(pdf: jsPDF, y: number) {
  setDraw(pdf, C.slate200)
  pdf.setLineWidth(0.3)
  pdf.line(MARGIN, y, PAGE_W - MARGIN, y)
  setText(pdf, C.slate500)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.text(
    'Instituto Winston Churchill · Documento generado electrónicamente',
    PAGE_W / 2,
    y + 5,
    { align: 'center' }
  )
  pdf.text(
    `Fecha de emisión: ${new Date().toISOString().slice(0, 10)}`,
    PAGE_W / 2,
    y + 9,
    { align: 'center' }
  )
}

export function generarPdfBoucher(datos: DatosPdfBoucher): Buffer {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const grado = gradoPdfBoucher(datos.alumnoNivel, datos.alumnoGrado)
  const logo = logoDataUrl(datos.alumnoNivel)

  const conceptoTexto = datos.ignorarMesPago
    ? 'Colegiatura'
    : (datos.conceptoClase?.trim() || getPaymentConcept(datos.conceptoNo))

  let y = dibujarEncabezado(pdf, datos, grado, logo)

  y = dibujarTarjetaReferencia(pdf, datos.referencia, datos.importe, conceptoTexto, y)

  y = dibujarSeccionAlumno(
    pdf,
    datos.nombreAlumno.toUpperCase(),
    getFullLevel(datos.alumnoNivel, grado),
    y
  )

  const colW = (CONTENT_W - 4) / 2
  const col1 = MARGIN
  const col2 = MARGIN + colW + 4
  const filasIzq: [string, string][] = [
    ['No. de emisión', getEmitter(datos.alumnoNivel, grado, 1)],
    ['Cliente', getClient(datos.alumnoNivel)],
    ['Banco', 'Banorte'],
  ]
  const filasDer: [string, string][] = [
    ['Validez', formatearFechaBoucher(datos.vigencia)],
    ['Fecha origen', new Date().toISOString().slice(0, 10)],
    ['Concepto', conceptoTexto],
  ]

  let yIzq = y
  let yDer = y
  for (const [lab, val] of filasIzq) {
    yIzq += dibujarFilaDetalle(pdf, lab, val, col1, yIzq, colW) + 2
  }
  for (const [lab, val] of filasDer) {
    yDer += dibujarFilaDetalle(pdf, lab, val, col2, yDer, colW) + 2
  }
  y = Math.max(yIzq, yDer) + 4

  y = dibujarAvisoLegal(pdf, datos, y)
  dibujarPie(pdf, y)

  return Buffer.from(pdf.output('arraybuffer'))
}
