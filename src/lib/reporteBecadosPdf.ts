import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ReporteBecadosResumen } from './reporteBecadosService'
import { etiquetaCicloLargo } from './reporteBecadosDocument'

export function generarPdfReporteBecados(
  resumen: ReporteBecadosResumen,
  opciones?: { titulo?: string }
): Buffer {
  const conPromedio = Boolean(resumen.conPromedio)
  const titulo =
    opciones?.titulo ??
    (conPromedio
      ? `Becados Winston · promedio ≥ ${resumen.umbralPromedio ?? 9}`
      : 'Alumnos becados')
  const pdf = new jsPDF({
    orientation: conPromedio ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  })
  let y = 16

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.setTextColor(0, 51, 102)
  pdf.text(titulo, conPromedio ? 148 : 105, y, { align: 'center' })
  y += 7

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(71, 85, 105)
  const sub = [
    `Ciclo ${etiquetaCicloLargo(resumen.ciclo)}`,
    resumen.nivelFiltroLabel,
    `${resumen.total} becados`,
    new Date().toLocaleDateString('es-MX'),
  ]
    .filter(Boolean)
    .join(' · ')
  pdf.text(sub, conPromedio ? 148 : 105, y, { align: 'center' })
  y += 8

  if (resumen.nota && resumen.total === 0) {
    pdf.setFontSize(11)
    pdf.setTextColor(51, 65, 85)
    const lines = pdf.splitTextToSize(resumen.nota, conPromedio ? 260 : 180)
    pdf.text(lines, 14, y)
    return Buffer.from(pdf.output('arraybuffer'))
  }

  const fmt = (n: number | null | undefined) =>
    n == null || Number.isNaN(n) ? '—' : n.toFixed(1)

  for (const grupo of resumen.gruposPorNivel) {
    if (y > (conPromedio ? 180 : 250)) {
      pdf.addPage()
      y = 16
    }

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(15, 23, 42)
    pdf.text(`${grupo.nivelLabel} — ${grupo.plantel}`, 14, y)
    y += 5

    const head = conPromedio
      ? [['#', 'Nombre', 'Grado', 'Grupo', 'Beca', '%', 'ES', 'EN', 'Prom.']]
      : [['#', 'Nombre', 'Grado', 'Grupo', 'Beca', '%']]

    const body = grupo.filas.map((f, i) => {
      const base = [
        String(i + 1),
        f.nombre,
        f.grado,
        f.grupo,
        f.becaClase,
        `${f.becaPorcentaje}%`,
      ]
      if (!conPromedio) return base
      const en =
        f.letraEn && f.promedioEn != null
          ? `${fmt(f.promedioEn)} (${f.letraEn})`
          : fmt(f.promedioEn)
      return [...base, fmt(f.promedioEs), en, fmt(f.promedio)]
    })

    autoTable(pdf, {
      startY: y,
      head,
      body,
      styles: { fontSize: conPromedio ? 7 : 7.5, cellPadding: 1.4 },
      headStyles: { fillColor: [180, 83, 9], textColor: 255 },
      margin: { left: 14, right: 14 },
      theme: 'striped',
    })

    y = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
    y += 8
  }

  return Buffer.from(pdf.output('arraybuffer'))
}
