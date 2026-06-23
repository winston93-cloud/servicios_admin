import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ResumenInscripcionesAdmin } from './inscripcionesAdminService'
import { escapeHtml, fechaReporteMx } from './renderDocument'

const HEADERS = [
  'NIVEL',
  'RI ESTIMADOS',
  'RI INSCRITOS',
  'RI DIFERENCIA',
  'NI ESTIMADOS',
  'NI INSCRITOS',
  'NI DIFERENCIA',
  'TOTAL ESTIMADO',
  'TOTAL INSCRITOS',
] as const

function filaATabla(f: ResumenInscripcionesAdmin['filas'][number]): string[] {
  const riDif = f.riEst - f.riPag
  const niDif = f.niEst - f.niPag
  const totalEst = f.riEst + f.niEst
  const totalIns = f.riPag + f.niPag
  return [
    f.nivelLabel,
    String(f.riEst),
    String(f.riPag),
    String(riDif),
    String(f.niEst),
    String(f.niPag),
    String(niDif),
    String(totalEst),
    String(totalIns),
  ]
}

export function construirHtmlReporteInscripciones(resumen: ResumenInscripcionesAdmin): string {
  const rows = resumen.filas
    .map((f) => {
      const cells = filaATabla(f)
      const trClass = f.esTotales ? ' class="totales"' : ''
      const tdHtml = cells
        .map((c, i) => {
          const diff = i === 3 || i === 6
          const cls = diff ? ' class="diff"' : ''
          return `<td${cls}>${escapeHtml(c)}</td>`
        })
        .join('')
      return `<tr${trClass}>${tdHtml}</tr>`
    })
    .join('')

  const head = HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(resumen.titulo)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 16px 20px; background: #fff; }
    .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
    .brand { font-size: 11px; font-weight: 700; color: #1e3a5f; line-height: 1.3; max-width: 180px; }
    .head-block { text-align: right; flex: 1; }
    .head-block h1 { margin: 0 0 4px; font-size: 1.15rem; font-weight: 800; color: #0f2744; }
    .head-block p { margin: 0; font-size: 0.82rem; color: #334155; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #1e3a5f; color: #fff; font-weight: 700; padding: 7px 6px; border: 1px solid #16304f; text-align: center; }
    td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: center; }
    td:first-child { text-align: left; font-weight: 600; }
    tbody tr:nth-child(odd):not(.totales) td:not(.diff) { background: #f8fafc; }
    tbody tr:nth-child(even):not(.totales) td:not(.diff) { background: #eef4fb; }
    td.diff { background: #3b82c4 !important; color: #fff; font-weight: 700; }
    tr.totales td { background: #e2e8f0 !important; color: #0f172a; font-weight: 800; }
    tr.totales td.diff { background: #2563a8 !important; color: #fff; }
    .legend { margin-top: 10px; padding: 6px 10px; background: #1e3a5f; color: #fff; font-size: 10px; font-weight: 600; }
    .foot { margin-top: 12px; text-align: center; font-size: 10px; color: #64748b; }
  </style>
</head>
<body>
  <div class="top">
    <div class="brand">Instituto<br />Winston Churchill</div>
    <div class="head-block">
      <h1>${escapeHtml(resumen.titulo)}</h1>
      <p>Ciclo Escolar ${escapeHtml(resumen.cicloLabel)}</p>
      <p>${escapeHtml(fechaReporteMx())}</p>
    </div>
  </div>
  <table>
    <thead><tr>${head}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="legend">Donde: NI = Nuevo Ingreso; RI = Reinscritos</p>
  <p class="foot">Generado en Servicios Admin</p>
</body>
</html>`
}

export function generarPdfReporteInscripciones(resumen: ResumenInscripcionesAdmin): Buffer {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(30, 58, 95)
  pdf.text('Instituto Winston Churchill', 14, 14)

  pdf.setFontSize(13)
  pdf.text(resumen.titulo, pageW - 14, 12, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(`Ciclo Escolar ${resumen.cicloLabel}`, pageW - 14, 18, { align: 'right' })
  pdf.text(fechaReporteMx(), pageW - 14, 23, { align: 'right' })

  const body = resumen.filas.map((f) => filaATabla(f))

  autoTable(pdf, {
    startY: 28,
    head: [HEADERS as unknown as string[]],
    body,
    styles: { fontSize: 7.5, cellPadding: 1.8, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      3: { fillColor: [59, 130, 196], textColor: 255, fontStyle: 'bold' },
      6: { fillColor: [59, 130, 196], textColor: 255, fontStyle: 'bold' },
    },
    didParseCell(data) {
      const fila = resumen.filas[data.row.index]
      if (!fila?.esTotales || data.section !== 'body') return
      data.cell.styles.fontStyle = 'bold'
      data.cell.styles.fillColor = data.column.index === 3 || data.column.index === 6 ? [37, 99, 168] : [226, 232, 240]
      data.cell.styles.textColor = data.column.index === 3 || data.column.index === 6 ? 255 : 15
    },
    margin: { left: 10, right: 10 },
    theme: 'grid',
  })

  const finalY = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 28
  pdf.setFillColor(30, 58, 95)
  pdf.rect(10, finalY + 3, pageW - 20, 6, 'F')
  pdf.setFontSize(7)
  pdf.setTextColor(255, 255, 255)
  pdf.text('Donde: NI = Nuevo Ingreso; RI = Reinscritos', 12, finalY + 7.2)

  return Buffer.from(pdf.output('arraybuffer'))
}
