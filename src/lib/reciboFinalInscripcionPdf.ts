import fs from 'fs'
import path from 'path'
import jsPDF from 'jspdf'
import QRCode from 'qrcode'
import { etiquetaCicloEscolar } from './cicloEscolar'
import { getFullLevel } from './boucherCore'

export interface DatosReciboFinalInscripcion {
  nombreAlumno: string
  alumnoRef: number
  nivel: number
  grado: number
  cicloEscolar: number
  formaIngresoEtiqueta: string
}

const PAGE_W = 215.9
const PAGE_H = 279.4
const MARGIN = 16
const CONTENT_W = PAGE_W - MARGIN * 2

const C = {
  navy: [8, 28, 52] as const,
  cyan: [34, 211, 238] as const,
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
  const alt = path.join(
    process.cwd(),
    'public',
    'logos',
    esEducativo(nivel) ? 'logo-winston-educativo.png' : 'logo-winston-churchill.png'
  )
  const ruta = fs.existsSync(full) ? full : fs.existsSync(alt) ? alt : null
  if (!ruta) return null
  const buf = fs.readFileSync(ruta)
  return {
    data: `data:image/png;base64,${buf.toString('base64')}`,
    w: esEducativo(nivel) ? 44 : 40,
    h: esEducativo(nivel) ? (fs.existsSync(full) ? 11 : 14) : fs.existsSync(full) ? 15 : 16,
  }
}

function hoyEtiqueta(): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function payloadQr(datos: DatosReciboFinalInscripcion): string {
  const ref = String(datos.alumnoRef).padStart(5, '0')
  // Compatible con lectura humana / escáner; incluye los datos del legacy (nombre) + control.
  return [
    'WINSTON',
    'RECIBO-FINAL',
    ref,
    datos.nombreAlumno.toUpperCase(),
    `N${datos.nivel}`,
    `C${datos.cicloEscolar}`,
    hoyEtiqueta(),
  ].join('|')
}

function dibujarCampo(
  pdf: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number
): number {
  const pad = 4
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  const lines = pdf.splitTextToSize(value || '—', w - pad * 2) as string[]
  const h = Math.max(18, 10 + lines.length * 5)

  setFill(pdf, C.slate50)
  setDraw(pdf, C.slate200)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(x, y, w, h, 2.5, 2.5, 'FD')

  setText(pdf, C.slate500)
  pdf.setFontSize(7.5)
  pdf.text(label.toUpperCase(), x + pad, y + 5.5)

  setText(pdf, C.slate900)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text(lines, x + pad, y + 12)

  return h
}

export async function generarPdfReciboFinalInscripcion(
  datos: DatosReciboFinalInscripcion
): Promise<Buffer> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const logo = logoDataUrl(datos.nivel)
  const qrPayload = payloadQr(datos)
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 280,
    color: { dark: '#0f172a', light: '#ffffff' },
  })

  const headerH = 48
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

  setText(pdf, C.white)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text(nombreInstitucion(datos.nivel), PAGE_W - MARGIN, 16, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text('Portal de inscripciones', PAGE_W - MARGIN, 22, { align: 'right' })
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.text('Recibo final de inscripción', PAGE_W - MARGIN, 36, { align: 'right' })

  let y = headerH + 14

  setFill(pdf, C.emeraldSoft)
  setDraw(pdf, C.emerald)
  pdf.setLineWidth(0.45)
  pdf.roundedRect(MARGIN, y, CONTENT_W, 16, 3, 3, 'FD')
  setText(pdf, C.emerald)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('Proceso completado', MARGIN + 6, y + 10)
  setText(pdf, C.slate700)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(
    `Ciclo ${etiquetaCicloEscolar(datos.cicloEscolar)} · ${datos.formaIngresoEtiqueta}`,
    PAGE_W - MARGIN - 6,
    y + 10,
    { align: 'right' }
  )
  y += 24

  setText(pdf, C.slate900)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('Datos del alumno', MARGIN, y)
  y += 6

  const colGap = 4
  const leftW = CONTENT_W - 58
  const h1 = dibujarCampo(pdf, 'Alumno', datos.nombreAlumno, MARGIN, y, leftW)
  y += h1 + 3

  const colW = (leftW - colGap) / 2
  const h2 = dibujarCampo(
    pdf,
    'No. de control',
    String(datos.alumnoRef).padStart(5, '0'),
    MARGIN,
    y,
    colW
  )
  const h3 = dibujarCampo(
    pdf,
    'Grado / nivel',
    getFullLevel(datos.nivel, datos.grado),
    MARGIN + colW + colGap,
    y,
    colW
  )
  y += Math.max(h2, h3) + 3

  const h4 = dibujarCampo(pdf, 'Estatus', 'Completado', MARGIN, y, colW)
  const h5 = dibujarCampo(pdf, 'Fecha', hoyEtiqueta(), MARGIN + colW + colGap, y, colW)
  y += Math.max(h4, h5) + 8

  // QR a la derecha del bloque de datos (estilo legacy, modernizado)
  const qrSize = 48
  const qrX = PAGE_W - MARGIN - qrSize
  const qrY = headerH + 38
  setFill(pdf, C.white)
  setDraw(pdf, C.slate200)
  pdf.roundedRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 18, 3, 3, 'FD')
  pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
  setText(pdf, C.slate500)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.text('Código de verificación', qrX + qrSize / 2, qrY + qrSize + 8, {
    align: 'center',
  })

  y = Math.max(y, qrY + qrSize + 22)

  setFill(pdf, C.slate100)
  setDraw(pdf, C.slate200)
  pdf.roundedRect(MARGIN, y, CONTENT_W, 28, 3, 3, 'FD')
  setText(pdf, C.slate700)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  const aviso = pdf.splitTextToSize(
    'Este recibo acredita que el proceso de inscripción quedó completo. Preséntalo en control escolar o administración si te lo solicitan. Conserva una copia digital o impresa.',
    CONTENT_W - 12
  ) as string[]
  pdf.text(aviso, MARGIN + 6, y + 10)

  const pieY = PAGE_H - 16
  setDraw(pdf, C.slate200)
  pdf.setLineWidth(0.3)
  pdf.line(MARGIN, pieY - 6, PAGE_W - MARGIN, pieY - 6)
  setText(pdf, C.slate500)
  pdf.setFontSize(7.5)
  pdf.text(
    `Generado el ${hoyEtiqueta()} · ${nombreInstitucion(datos.nivel)}`,
    PAGE_W / 2,
    pieY,
    { align: 'center' }
  )

  return Buffer.from(pdf.output('arraybuffer'))
}
