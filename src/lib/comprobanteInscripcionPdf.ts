import jsPDF from 'jspdf'
import { etiquetaCicloEscolar } from './cicloEscolar'
import { getFullLevel, getPaymentConcept } from './boucherCore'

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

export function generarPdfComprobanteInscripcion(datos: DatosComprobanteInscripcion): Buffer {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const margin = 18
  let y = 22

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.text('Comprobante de inscripción', margin, y)
  y += 10

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.text(`Alumno: ${datos.nombreAlumno}`, margin, y)
  y += 6
  pdf.text(`No. control: ${datos.alumnoRef}`, margin, y)
  y += 6
  pdf.text(`Grado: ${getFullLevel(datos.nivel, datos.grado)}`, margin, y)
  y += 6
  pdf.text(`Ciclo escolar: ${etiquetaCicloEscolar(datos.cicloEscolar)}`, margin, y)
  y += 10

  pdf.setFont('helvetica', 'bold')
  pdf.text('Pagos registrados', margin, y)
  y += 8
  pdf.setFont('helvetica', 'normal')

  for (const p of datos.pagos) {
    if (y > 250) {
      pdf.addPage()
      y = 22
    }
    pdf.text(
      `${getPaymentConcept(p.conceptoNo)} — $${p.importe.toFixed(2)} — ${p.fecha} — ${p.formaPago}`,
      margin,
      y
    )
    y += 5
    pdf.setFontSize(9)
    pdf.text(`Referencia: ${p.referencia}`, margin + 4, y)
    y += 7
    pdf.setFontSize(11)
  }

  if (datos.pagos.length === 0) {
    pdf.text('No se encontraron pagos de inscripción para este ciclo.', margin, y)
  }

  return Buffer.from(pdf.output('arraybuffer'))
}
