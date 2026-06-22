import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function etiquetaCicloReporte(ciclo: number): string {
  const inicio = ciclo + 2003
  return `${inicio}-${inicio + 1}`
}

export function fechaReporteMx(): string {
  return new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

type TablaHtml = {
  headers: string[]
  rows: string[][]
}

export function construirHtmlReporteTabla(opts: {
  titulo: string
  subtitulo: string
  meta?: string
  tablas: { titulo?: string; tabla: TablaHtml }[]
}): string {
  const sections = opts.tablas
    .map(({ titulo, tabla }) => {
      const head = tabla.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
      const body = tabla.rows
        .map(
          (row) =>
            `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`
        )
        .join('')
      return `
      <section class="block">
        ${titulo ? `<h2>${escapeHtml(titulo)}</h2>` : ''}
        <table>
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </section>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(opts.titulo)}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    body { font-family: system-ui, sans-serif; color: #0f172a; background: #f8fafc; margin: 0; padding: 24px; }
    .hero { text-align: center; margin-bottom: 24px; padding: 20px; background: linear-gradient(135deg, #0f2744, #1e3a5f); color: #fff; border-radius: 12px; }
    .hero h1 { margin: 0 0 6px; font-size: 1.5rem; }
    .hero p { margin: 0; opacity: 0.9; font-size: 0.9rem; }
    .block { background: #fff; border-radius: 10px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .block h2 { margin: 0 0 12px; font-size: 1rem; color: #334155; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; font-weight: 700; }
    tr:nth-child(even) td { background: #fafafa; }
    .foot { text-align: center; font-size: 11px; color: #64748b; margin-top: 20px; }
  </style>
</head>
<body>
  <header class="hero">
    <h1>${escapeHtml(opts.titulo)}</h1>
    <p>${escapeHtml(opts.subtitulo)}</p>
    ${opts.meta ? `<p style="margin-top:8px;font-size:0.8rem">${escapeHtml(opts.meta)}</p>` : ''}
  </header>
  ${sections}
  <p class="foot">Generado en Servicios Admin · ${escapeHtml(fechaReporteMx())}</p>
</body>
</html>`
}

export function generarPdfReporteTabla(opts: {
  titulo: string
  subtitulo: string
  meta?: string
  headers: string[]
  rows: string[][]
  headColor?: [number, number, number]
}): Buffer {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let y = 16

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(15)
  pdf.setTextColor(15, 39, 68)
  pdf.text(opts.titulo, 105, y, { align: 'center' })
  y += 7

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(71, 85, 105)
  pdf.text(opts.subtitulo, 105, y, { align: 'center' })
  y += 5
  if (opts.meta) {
    pdf.setFontSize(8)
    pdf.text(opts.meta, 105, y, { align: 'center' })
    y += 5
  }
  y += 4

  autoTable(pdf, {
    startY: y,
    head: [opts.headers],
    body: opts.rows,
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    headStyles: { fillColor: opts.headColor ?? [30, 64, 175], textColor: 255 },
    margin: { left: 12, right: 12 },
    theme: 'striped',
  })

  return Buffer.from(pdf.output('arraybuffer'))
}
