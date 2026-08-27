import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ResumenNuevoIngreso } from './nuevoIngresoService'
import {
  nuevoIngresoATabla,
  nuevoIngresoResumenATabla,
} from './nuevoIngresoService'
import {
  escapeHtml,
  fechaReporteMx,
} from './renderDocument'

/** HTML al estilo legacy: fila alumno + subfilas Mamá/Papá + resumen por grado. */
export function construirHtmlReporteNuevoIngreso(resumen: ResumenNuevoIngreso): string {
  const esDeben = resumen.modo === 'deben'
  const meta = `${resumen.filas.length} alumno(s)`
  const sinPagoCount = resumen.filas.filter((f) => !f.pagado).length

  const bodyRows = resumen.filas
    .map((f) => {
      const sinPago = !esDeben && !f.pagado
      const fechaPagoCell = esDeben
        ? ''
        : sinPago
          ? '<span class="badge-sin-pago">SIN PAGO</span>'
          : escapeHtml(f.fechaPago)

      const main = esDeben
        ? `<tr class="alumno">
            <td>${escapeHtml(String(f.no))}</td>
            <td>${escapeHtml(f.grado)}</td>
            <td>${escapeHtml(f.noCtrl)}</td>
            <td>${escapeHtml(f.alta)}</td>
            <td>${escapeHtml(f.nombre)}</td>
          </tr>`
        : `<tr class="alumno${sinPago ? ' sin-pago' : ''}">
            <td>${escapeHtml(String(f.no))}</td>
            <td>${escapeHtml(f.grado)}</td>
            <td>${escapeHtml(f.noCtrl)}</td>
            <td>${escapeHtml(f.alta)}</td>
            <td>${escapeHtml(f.nombre)}</td>
            <td class="fecha-pago">${fechaPagoCell}</td>
          </tr>`

      if (esDeben || f.familiares.length === 0) return main

      const famRows = f.familiares
        .map(
          (fam) => `<tr class="familiar${sinPago ? ' familiar-sin-pago' : ''}">
            <td></td>
            <td class="rol">${escapeHtml(fam.rol)}:</td>
            <td colspan="2">${escapeHtml(fam.nombre)}</td>
            <td>${escapeHtml(fam.cel)}</td>
            <td>${escapeHtml(fam.email)}</td>
          </tr>`
        )
        .join('')

      return main + famRows
    })
    .join('')

  const colFecha = 'Alta'
  const head = esDeben
    ? `<th>#</th><th>Grado</th><th>No. Ctrl</th><th>${colFecha}</th><th>Nombre</th>`
    : `<th>#</th><th>Grado</th><th>No. Ctrl</th><th>${colFecha}</th><th>Nombre</th><th>F. pago</th>`

  const resumenTabla = nuevoIngresoResumenATabla(resumen)
  const resumenHead = resumenTabla.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
  const resumenBody = resumenTabla.rows
    .map((row, idx) => {
      const isTotal = idx === resumenTabla.rows.length - 1
      return `<tr${isTotal ? ' class="totales"' : ''}>${row
        .map((c) => `<td>${escapeHtml(c)}</td>`)
        .join('')}</tr>`
    })
    .join('')

  const metaPago =
    !esDeben && sinPagoCount > 0
      ? ` · <span class="meta-sin-pago">${sinPagoCount} sin pago de inscripción</span>`
      : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(resumen.titulo)}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    body { font-family: system-ui, sans-serif; color: #0f172a; background: #f8fafc; margin: 0; padding: 24px; }
    .hero { text-align: center; margin-bottom: 24px; padding: 20px; background: linear-gradient(135deg, #0f2744, #1e3a5f); color: #fff; border-radius: 12px; }
    .hero h1 { margin: 0 0 6px; font-size: 1.5rem; }
    .hero p { margin: 0; opacity: 0.9; font-size: 0.9rem; }
    .meta-sin-pago { color: #fecaca; font-weight: 700; opacity: 1; }
    .block { background: #fff; border-radius: 10px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .block h2 { margin: 0 0 12px; font-size: 1rem; color: #334155; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; font-weight: 700; }
    tr.alumno td { border-top: 2px solid #cbd5e1; }
    tr.alumno.sin-pago td { background: #fef2f2; }
    tr.alumno.sin-pago td.fecha-pago { font-weight: 800; color: #b91c1c; text-align: center; }
    .badge-sin-pago {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      background: #dc2626;
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.04em;
    }
    tr.familiar td { background: #f8fafc; color: #475569; font-size: 11px; border-top: none; }
    tr.familiar.familiar-sin-pago td { background: #fff1f2; }
    tr.familiar td.rol { font-weight: 600; color: #334155; }
    tr.totales td { font-weight: 700; background: #f1f5f9; }
    .foot { text-align: center; font-size: 11px; color: #64748b; margin-top: 20px; }
    .leyenda { margin: 0 0 12px; font-size: 12px; color: #7f1d1d; }
    .leyenda strong { color: #dc2626; }
  </style>
</head>
<body>
  <header class="hero">
    <h1>${escapeHtml(resumen.titulo)}</h1>
    <p>${escapeHtml(resumen.nivelLabel)} · Ciclo ${escapeHtml(resumen.cicloLabel)}</p>
    <p style="margin-top:8px;font-size:0.8rem">${escapeHtml(meta)}${metaPago}</p>
  </header>
  <section class="block">
    ${
      !esDeben && sinPagoCount > 0
        ? `<p class="leyenda"><strong>SIN PAGO</strong> = inscripción (concepto 13) pendiente. Filas en rojo.</p>`
        : ''
    }
    <table>
      <thead><tr>${head}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </section>
  <section class="block">
    <h2>Resumen por grado</h2>
    <table>
      <thead><tr>${resumenHead}</tr></thead>
      <tbody>${resumenBody}</tbody>
    </table>
  </section>
  <p class="foot">Generado en Servicios Admin · ${escapeHtml(fechaReporteMx())}</p>
</body>
</html>`
}

export function generarPdfReporteNuevoIngreso(resumen: ResumenNuevoIngreso): Buffer {
  const pdf = new jsPDF({
    orientation: resumen.modo === 'completo' ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  })
  const pageW = pdf.internal.pageSize.getWidth()
  let y = 14

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.setTextColor(15, 39, 68)
  pdf.text(resumen.titulo, pageW / 2, y, { align: 'center' })
  y += 6

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(71, 85, 105)
  pdf.text(`${resumen.nivelLabel} · Ciclo ${resumen.cicloLabel}`, pageW / 2, y, {
    align: 'center',
  })
  y += 5
  pdf.setFontSize(8)
  const sinPagoCount = resumen.filas.filter((f) => !f.pagado).length
  const metaLine =
    sinPagoCount > 0
      ? `${resumen.filas.length} alumno(s) · ${sinPagoCount} SIN PAGO de inscripción`
      : `${resumen.filas.length} alumno(s)`
  pdf.text(metaLine, pageW / 2, y, { align: 'center' })
  y += 6

  if (resumen.modo === 'completo') {
    // Filas alumno + subfilas de contactos (como legacy PDF).
    const body: string[][] = []
    for (const f of resumen.filas) {
      body.push([
        String(f.no),
        f.grado,
        f.noCtrl,
        f.alta,
        f.nombre,
        f.pagado ? f.fechaPago : 'SIN PAGO',
      ])
      for (const fam of f.familiares) {
        body.push(['', fam.rol + ':', fam.nombre, fam.cel, fam.email, ''])
      }
    }

    autoTable(pdf, {
      startY: y,
      head: [['#', 'Grado', 'No. Ctrl', 'Alta', 'Nombre', 'F. pago']],
      body,
      styles: { fontSize: 7, cellPadding: 1.2 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255 },
      margin: { left: 10, right: 10 },
      theme: 'striped',
      didParseCell: (data) => {
        if (data.section !== 'body' || !data.row.raw) return
        const raw = data.row.raw as string[]
        const first = String(raw[0] ?? '')
        if (first === '') {
          data.cell.styles.fillColor = [248, 250, 252]
          data.cell.styles.textColor = [71, 85, 105]
          data.cell.styles.fontSize = 6.5
          return
        }
        if (String(raw[5] ?? '') === 'SIN PAGO') {
          data.cell.styles.fillColor = [254, 226, 226]
          if (data.column.index === 5) {
            data.cell.styles.textColor = [185, 28, 28]
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.halign = 'center'
          }
        }
      },
    })
  } else {
    const tabla = nuevoIngresoATabla(resumen)
    autoTable(pdf, {
      startY: y,
      head: [tabla.headers],
      body: tabla.rows,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255 },
      margin: { left: 12, right: 12 },
      theme: 'striped',
    })
  }

  const resumenTabla = nuevoIngresoResumenATabla(resumen)
  const lastY =
    (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 10

  autoTable(pdf, {
    startY: lastY + 8,
    head: [resumenTabla.headers],
    body: resumenTabla.rows,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [15, 39, 68], textColor: 255 },
    margin: { left: 12, right: 12 },
    theme: 'grid',
    tableWidth: resumen.modo === 'deben' ? 60 : 90,
  })

  return Buffer.from(pdf.output('arraybuffer'))
}
