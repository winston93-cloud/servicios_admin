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

function logoDataUrl(nivel: number): { data: string; w: number; h: number } | null {
  const file = nivel < 3 ? 'educativo.png' : 'logo_full.png'
  const full = path.join(process.cwd(), 'public', 'bauchers', file)
  if (!fs.existsSync(full)) return null
  const buf = fs.readFileSync(full)
  const data = `data:image/png;base64,${buf.toString('base64')}`
  return nivel < 3 ? { data, w: 85, h: 20 } : { data, w: 95, h: 35 }
}

function filaTabla(
  pdf: jsPDF,
  etiqueta: string,
  valor: string,
  y: number
): number {
  pdf.setFillColor(168, 168, 168)
  pdf.setTextColor(0, 0, 0)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(14)
  pdf.rect(10, y, 60, 8, 'FD')
  pdf.rect(70, y, 120, 8, 'D')
  pdf.text(etiqueta, 12, y + 5.5)
  pdf.text(valor, 72, y + 5.5)
  return y + 8
}

export function generarPdfBoucher(datos: DatosPdfBoucher): Buffer {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const grado = gradoPdfBoucher(datos.alumnoNivel, datos.alumnoGrado)
  const logo = logoDataUrl(datos.alumnoNivel)

  if (logo) {
    pdf.addImage(logo.data, 'PNG', datos.alumnoNivel < 3 ? 10 : 1, datos.alumnoNivel < 3 ? 10 : 5, logo.w, logo.h)
  }

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(20)
  pdf.text('', 10, 20)
  pdf.text('Baucher de pago', 100, 22)

  pdf.setFontSize(14)
  const cicloEtiqueta = etiquetaCicloEscolar(datos.cicloEscolar)
  pdf.text(`Ciclo Escolar ${cicloEtiqueta}`, 103, 34)

  let y = 55
  y = filaTabla(pdf, 'No de Emisión', getEmitter(datos.alumnoNivel, grado, 1), y)
  y = filaTabla(pdf, 'Cliente:', getClient(datos.alumnoNivel), y)
  y = filaTabla(pdf, 'Banco:', 'Banorte', y)

  pdf.setFontSize(12)
  y = filaTabla(pdf, 'Nombre del alumno:', datos.nombreAlumno.toUpperCase(), y)
  pdf.setFontSize(14)
  y = filaTabla(
    pdf,
    'Nivel & Grado:',
    getFullLevel(datos.alumnoNivel, grado),
    y
  )

  const conceptoTexto = datos.ignorarMesPago
    ? 'Colegiatura'
    : (datos.conceptoClase?.trim() || getPaymentConcept(datos.conceptoNo))
  y = filaTabla(pdf, 'Concepto:', conceptoTexto, y)
  y = filaTabla(pdf, 'Referencia:', datos.referencia, y)
  y = filaTabla(pdf, 'Validez:', formatearFechaBoucher(datos.vigencia), y)
  y = filaTabla(pdf, 'Importe:', formatearMonedaBoucher(datos.importe), y)

  const hoy = new Date().toISOString().slice(0, 10)
  y = filaTabla(pdf, 'Fecha Origen:', hoy, y)

  y += 10
  pdf.setFontSize(11)
  if (datos.aplicarRecargos) {
    pdf.text(
      '* El pago de Colegiaturas y Material de Enero es del 1 al 10 de cada mes (días naturales).',
      10,
      y
    )
    y += 6
    pdf.text(
      '  A partir del día 11 causará $50.00 por mes hasta su liquidación *.',
      10,
      y
    )
    y += 10
  }

  pdf.text('* BAJO NINGUNA CIRCUNSTANCIA EL BAUCHER PUEDE SER LLENADO A MANO', 10, y)
  y += 6
  pdf.text('  YA QUE EL BANCO NO AUTORIZA ESTE MOVIMIENTO *', 10, y)

  return Buffer.from(pdf.output('arraybuffer'))
}
