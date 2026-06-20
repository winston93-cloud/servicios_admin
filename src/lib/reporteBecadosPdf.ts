import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ReporteBecadosResumen } from './reporteBecadosService'
import { etiquetaCicloLargo } from './reporteBecadosDocument'

export function generarPdfReporteBecados(resumen: ReporteBecadosResumen): Buffer {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let y = 16

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.setTextColor(146, 64, 14)
  pdf.text('Alumnos becados', 105, y, { align: 'center' })
  y += 7

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(71, 85, 105)
  pdf.text(
    `Ciclo ${etiquetaCicloLargo(resumen.ciclo)} · ${resumen.total} becados · ${new Date().toLocaleDateString('es-MX')}`,
    105,
    y,
    { align: 'center' }
  )
  y += 8

  for (const grupo of resumen.gruposPorNivel) {
    if (y > 250) {
      pdf.addPage()
      y = 16
    }

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(15, 23, 42)
    pdf.text(`${grupo.nivelLabel} — ${grupo.plantel}`, 14, y)
    y += 5

    autoTable(pdf, {
      startY: y,
      head: [['#', 'Nombre', 'Grado', 'Grupo', 'Beca', '%']],
      body: grupo.filas.map((f, i) => [
        String(i + 1),
        f.nombre,
        f.grado,
        f.grupo,
        f.becaClase,
        `${f.becaPorcentaje}%`,
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.4 },
      headStyles: { fillColor: [180, 83, 9], textColor: 255 },
      margin: { left: 14, right: 14 },
      theme: 'striped',
    })

    y = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
    y += 8
  }

  return Buffer.from(pdf.output('arraybuffer'))
}
