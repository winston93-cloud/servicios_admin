import fs from 'fs'
import path from 'path'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { AlumnoDeudorSuspension } from './suspensionesService'
import { ETIQUETAS_TIPO_SUSPENSION, type TipoReporteSuspension } from './suspensionesAdeudos'
import { nombrePlantel, nombrePlantelCorto } from './suspensionesEtiquetas'

function leerLogoBase64(plantel: 1 | 2): string | null {
  const archivo =
    plantel === 1 ? 'logo-winston-educativo.png' : 'logo-winston-churchill.png'
  const ruta = path.join(process.cwd(), 'public', 'logos', archivo)
  try {
    const buf = fs.readFileSync(ruta)
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

function formatearFechaCarta(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function generarPdfListaSuspendidos(opts: {
  deudores: AlumnoDeudorSuspension[]
  plantel: 1 | 2
  tipo: TipoReporteSuspension
  cicloLargo: number
  fechaCartas: string
}): Buffer {
  const { deudores, plantel, tipo, cicloLargo } = opts
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const logo = leerLogoBase64(plantel)

  if (logo) pdf.addImage(logo, 'PNG', 10, 15, 22, 18)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.text(`Lista de alumnos Ciclo ${cicloLargo}-${cicloLargo + 1}`, 105, 20, {
    align: 'center',
  })
  pdf.setFontSize(12)
  pdf.text(
    `${ETIQUETAS_TIPO_SUSPENSION[tipo]} · ${nombrePlantelCorto(plantel)}`,
    105,
    28,
    { align: 'center' }
  )
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(
    `Fecha de consulta: ${new Date().toLocaleDateString('es-MX')}`,
    105,
    34,
    { align: 'center' }
  )

  autoTable(pdf, {
    startY: 42,
    head: [['#', 'Control', 'Alumno', 'Grado', 'Modalidad', 'Deudas', 'Prórroga']],
    body: deudores.map((d, i) => [
      String(i + 1),
      d.alumnoRef,
      d.nombre,
      d.gradoEtiqueta,
      d.planMes === 1 ? '10 meses' : d.planMes === 2 ? '11 meses' : 'N/D',
      d.adeudos,
      d.prorroga ?? '—',
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 16 },
      2: { cellWidth: 48 },
      3: { cellWidth: 26 },
      4: { cellWidth: 20 },
      5: { cellWidth: 48 },
      6: { cellWidth: 22 },
    },
  })

  return Buffer.from(pdf.output('arraybuffer'))
}

export function generarPdfCartaSuspension(opts: {
  deudor: AlumnoDeudorSuspension
  plantel: 1 | 2
  fechaCartas: string
}): Buffer {
  const { deudor, plantel, fechaCartas } = opts
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const logo = leerLogoBase64(plantel)
  const institucion =
    plantel === 1 ? 'INSTITUTO EDUCATIVO WINSTON' : 'INSTITUTO WINSTON CHURCHILL'

  if (logo) pdf.addImage(logo, 'PNG', 15, 15, 22, 27)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text(institucion, 130, 18, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text('Educación Integral de Calidad', 130, 24, { align: 'center' })

  pdf.setDrawColor(41, 128, 185)
  pdf.setLineWidth(0.8)
  pdf.line(15, 58, 200, 58)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(15)
  pdf.setTextColor(41, 128, 185)
  pdf.text('AVISO DE SUSPENSIÓN ADMINISTRATIVA', 105, 72, { align: 'center' })
  pdf.setTextColor(0, 0, 0)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.text(`Cd. Madero, Tamaulipas a ${formatearFechaCarta(fechaCartas)}`, 195, 82, {
    align: 'right',
  })

  pdf.setFontSize(12)
  pdf.text('Estimado Padre de Familia:', 15, 96)

  pdf.setFontSize(11)
  const p1 =
    'Por medio de la presente, nos dirigimos a usted para comunicarle que debido a que el(la) alumno(a):'
  pdf.text(p1, 15, 108, { maxWidth: 180 })

  pdf.setFillColor(240, 248, 255)
  pdf.setDrawColor(41, 128, 185)
  pdf.rect(15, 118, 180, 10, 'FD')
  pdf.setFont('helvetica', 'bold')
  pdf.text(deudor.nombre, 105, 125, { align: 'center' })

  pdf.setFont('helvetica', 'normal')
  const p2 = `Tiene pendiente de pago ${deudor.adeudos}, no podrá ser recibido(a) en el Instituto ni podrá participar en ningún evento organizado por el mismo a partir del día:`
  pdf.text(p2, 15, 138, { maxWidth: 180 })

  pdf.setFillColor(255, 245, 245)
  pdf.setDrawColor(220, 53, 69)
  pdf.rect(15, 158, 180, 10, 'FD')
  pdf.setFont('helvetica', 'bold')
  pdf.text(formatearFechaCarta(fechaCartas), 105, 165, { align: 'center' })

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.text(
    'Le solicitamos que contacte a la dirección por medio de correo electrónico lo más pronto posible para aclarar la situación y regularizar los pagos pendientes.',
    15,
    178,
    { maxWidth: 180 }
  )

  pdf.setFont('helvetica', 'italic')
  pdf.setFontSize(10)
  pdf.setTextColor(100, 100, 100)
  pdf.text(
    'Agradecemos su comprensión y esperamos resolver esta situación a la brevedad posible.',
    15,
    198,
    { maxWidth: 180 }
  )
  pdf.setTextColor(0, 0, 0)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('ATENTAMENTE', 105, 220, { align: 'center' })
  pdf.setFontSize(9)
  pdf.text('DIRECCIÓN ACADÉMICA', 105, 228, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.text(nombrePlantel(plantel), 105, 234, { align: 'center' })

  pdf.setFontSize(8)
  pdf.setTextColor(100, 100, 100)
  pdf.text(
    'Este documento ha sido generado de manera automática. Para mayor información contacte a la dirección académica.',
    105,
    255,
    { align: 'center', maxWidth: 180 }
  )

  return Buffer.from(pdf.output('arraybuffer'))
}
