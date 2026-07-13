import fs from 'fs'
import path from 'path'
import jsPDF from 'jspdf'
import { etiquetaCicloEscolar } from './cicloEscolar'
import { formatearMonedaBoucher, getFullLevel, getPaymentConcept } from './boucherCore'

export interface PagoInscripcionComprobante {
  referencia: string
  importe: number
  fecha: string
  formaPago: string
  conceptoNo: string
}

export interface DatosComprobanteInscripcion {
  nombreAlumno: string
  alumnoRef: number
  nivel: number
  grado: number
  cicloEscolar: number
  pagos: PagoInscripcionComprobante[]
}

const PAGE_W = 215.9
const PAGE_H = 279.4
const MARGIN = 16
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
  emerald: [16, 185, 129] as const,
  emeraldSoft: [236, 253, 245] as const,
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

function esEducativo(nivel: number): boolean {
  return nivel === 1 || nivel === 2
}

function nombreInstitucion(nivel: number): string {
  return esEducativo(nivel)
    ? 'Instituto Educativo Winston'
    : 'Instituto Winston Churchill'
}

function logoDataUrl(nivel: number): { data: string; w: number; h: number } | null {
  const file = esEducativo(nivel) ? 'educativo.png' : 'logo_full.png'
  const full = path.join(process.cwd(), 'public', 'bauchers', file)
  if (!fs.existsSync(full)) {
    const alt = path.join(
      process.cwd(),
      'public',
      'logos',
      esEducativo(nivel) ? 'logo-winston-educativo.png' : 'logo-winston-churchill.png'
    )
    if (!fs.existsSync(alt)) return null
    const buf = fs.readFileSync(alt)
    return {
      data: `data:image/png;base64,${buf.toString('base64')}`,
      w: esEducativo(nivel) ? 44 : 40,
      h: esEducativo(nivel) ? 14 : 16,
    }
  }
  const buf = fs.readFileSync(full)
  const data = `data:image/png;base64,${buf.toString('base64')}`
  return esEducativo(nivel) ? { data, w: 44, h: 11 } : { data, w: 40, h: 15 }
}

function formatearFechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

function hoyEtiqueta(): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function dibujarEncabezado(
  pdf: jsPDF,
  nivel: number,
  cicloEscolar: number,
  logo: { data: string; w: number; h: number } | null
): number {
  const headerH = 46
  setFill(pdf, C.navy)
  pdf.rect(0, 0, PAGE_W, headerH, 'F')
  setFill(pdf, C.cyan)
  pdf.rect(0, headerH - 2.8, PAGE_W, 2.8, 'F')

  if (logo) {
    try {
      pdf.addImage(logo.data, 'PNG', MARGIN, 10, logo.w, logo.h)
    } catch {
      /* logo opcional */
    }
  }

  const textX = logo ? MARGIN + logo.w + 7 : MARGIN
  setText(pdf, C.white)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.text(nombreInstitucion(nivel), textX, 16)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text('Comprobante de inscripción', textX, 22)
  setText(pdf, C.cyan)
  pdf.setFontSize(8)
  pdf.text('Documento oficial de pagos registrados', textX, 28)

  const cicloEtiqueta = etiquetaCicloEscolar(cicloEscolar)
  const badgeW = 54
  const badgeX = PAGE_W - MARGIN - badgeW
  setFill(pdf, C.navyMid)
  pdf.roundedRect(badgeX, 11, badgeW, 18, 2.5, 2.5, 'F')
  setText(pdf, C.cyan)
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'bold')
  pdf.text('CICLO ESCOLAR', badgeX + badgeW / 2, 17, { align: 'center' })
  setText(pdf, C.white)
  pdf.setFontSize(10)
  pdf.text(cicloEtiqueta, badgeX + badgeW / 2, 24, { align: 'center' })

  return headerH + 10
}

function dibujarCampo(
  pdf: jsPDF,
  etiqueta: string,
  valor: string,
  x: number,
  y: number,
  ancho: number
): number {
  const lines = pdf.splitTextToSize(valor, ancho - 8)
  const h = Math.max(16, 9 + lines.length * 4.4)

  setFill(pdf, C.white)
  setDraw(pdf, C.slate200)
  pdf.setLineWidth(0.25)
  pdf.roundedRect(x, y, ancho, h, 2, 2, 'FD')

  setText(pdf, C.slate500)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.text(etiqueta.toUpperCase(), x + 3.5, y + 4.5)

  setText(pdf, C.slate900)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text(lines, x + 3.5, y + 10)

  return h
}

function dibujarTarjetaPago(
  pdf: jsPDF,
  pago: PagoInscripcionComprobante,
  y: number
): number {
  const cardH = 38
  if (y + cardH > PAGE_H - 28) {
    pdf.addPage()
    y = 20
  }

  setFill(pdf, C.slate50)
  setDraw(pdf, C.slate200)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(MARGIN, y, CONTENT_W, cardH, 3.5, 3.5, 'FD')

  setFill(pdf, C.navy)
  pdf.roundedRect(MARGIN, y, CONTENT_W, 11, 3.5, 3.5, 'F')
  pdf.rect(MARGIN, y + 6, CONTENT_W, 5, 'F')

  setText(pdf, C.white)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text(getPaymentConcept(pago.conceptoNo), MARGIN + 5, y + 7.5)

  setFill(pdf, C.emerald)
  pdf.roundedRect(PAGE_W - MARGIN - 28, y + 2.5, 23, 6, 2, 2, 'F')
  setText(pdf, C.white)
  pdf.setFontSize(7)
  pdf.text('PAGADO', PAGE_W - MARGIN - 16.5, y + 6.5, { align: 'center' })

  const bodyY = y + 16
  setText(pdf, C.slate500)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  pdf.text('REFERENCIA', MARGIN + 5, bodyY)
  setText(pdf, C.slate900)
  pdf.setFont('courier', 'bold')
  pdf.setFontSize(12)
  pdf.text(pago.referencia, MARGIN + 5, bodyY + 7)

  const rightX = PAGE_W - MARGIN - 5
  setText(pdf, C.slate500)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  pdf.text('IMPORTE', rightX, bodyY, { align: 'right' })
  setText(pdf, C.goldDark)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(15)
  pdf.text(formatearMonedaBoucher(pago.importe), rightX, bodyY + 8, { align: 'right' })

  setText(pdf, C.slate700)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text(
    `${formatearFechaCorta(pago.fecha)}  ·  ${pago.formaPago || 'Pago registrado'}`,
    MARGIN + 5,
    y + cardH - 5
  )

  return y + cardH + 8
}

function dibujarPie(pdf: jsPDF) {
  const y = PAGE_H - 16
  setDraw(pdf, C.slate200)
  pdf.setLineWidth(0.3)
  pdf.line(MARGIN, y - 6, PAGE_W - MARGIN, y - 6)
  setText(pdf, C.slate500)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  pdf.text(
    `Generado el ${hoyEtiqueta()} · Conserva este comprobante para tus registros`,
    PAGE_W / 2,
    y,
    { align: 'center' }
  )
}

export function generarPdfComprobanteInscripcion(datos: DatosComprobanteInscripcion): Buffer {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const logo = logoDataUrl(datos.nivel)
  let y = dibujarEncabezado(pdf, datos.nivel, datos.cicloEscolar, logo)

  setText(pdf, C.slate900)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('Datos del alumno', MARGIN, y)
  y += 5

  const colGap = 4
  const colW = (CONTENT_W - colGap) / 2
  const h1 = dibujarCampo(pdf, 'Alumno', datos.nombreAlumno, MARGIN, y, colW)
  const h2 = dibujarCampo(
    pdf,
    'No. de control',
    String(datos.alumnoRef).padStart(5, '0'),
    MARGIN + colW + colGap,
    y,
    colW
  )
  y += Math.max(h1, h2) + 3

  const h3 = dibujarCampo(
    pdf,
    'Grado / nivel',
    getFullLevel(datos.nivel, datos.grado),
    MARGIN,
    y,
    colW
  )
  const h4 = dibujarCampo(
    pdf,
    'Ciclo escolar',
    etiquetaCicloEscolar(datos.cicloEscolar),
    MARGIN + colW + colGap,
    y,
    colW
  )
  y += Math.max(h3, h4) + 10

  setText(pdf, C.slate900)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('Pagos registrados', MARGIN, y)
  y += 6

  if (datos.pagos.length === 0) {
    setFill(pdf, C.slate100)
    setDraw(pdf, C.slate200)
    pdf.roundedRect(MARGIN, y, CONTENT_W, 22, 3, 3, 'FD')
    setText(pdf, C.slate700)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.text(
      'No se encontraron pagos de inscripción para este ciclo.',
      MARGIN + 5,
      y + 13
    )
  } else {
    const total = datos.pagos.reduce((s, p) => s + p.importe, 0)
    for (const p of datos.pagos) {
      y = dibujarTarjetaPago(pdf, p, y)
    }

    setFill(pdf, C.emeraldSoft)
    setDraw(pdf, C.emerald)
    pdf.setLineWidth(0.4)
    pdf.roundedRect(MARGIN, y, CONTENT_W, 14, 3, 3, 'FD')
    setText(pdf, C.slate700)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text('Total inscrito', MARGIN + 5, y + 9)
    setText(pdf, C.navy)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    pdf.text(formatearMonedaBoucher(total), PAGE_W - MARGIN - 5, y + 9, { align: 'right' })
  }

  dibujarPie(pdf)

  return Buffer.from(pdf.output('arraybuffer'))
}
