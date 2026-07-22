import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ResumenReinscritosPagos } from './reinscritosPagosService'
import {
  reinscritosPagosATabla,
  reinscritosResumenATabla,
} from './reinscritosPagosService'
import { escapeHtml, fechaReporteMx } from './renderDocument'

function subtituloCiclo(resumen: ResumenReinscritosPagos): string {
  if (resumen.cicloEscolar === resumen.cicloInscripcion) {
    return `Inscripción ${resumen.cicloLabel}`
  }
  return `Inscripción ${resumen.cicloLabel} · fichas ${resumen.cicloEscolarLabel}`
}

function leyendaConceptos(modo: ResumenReinscritosPagos['modo']): string {
  return modo === '1-pago'
    ? 'Objetivo: 1er diferido / pago único (conceptos 11 o 13).'
    : 'Objetivo: 2do diferido (conceptos 12 o 13). Se muestra también el 1er diferido (11).'
}

export function construirHtmlReporteReinscritos(resumen: ResumenReinscritosPagos): string {
  const dosPagos = resumen.modo === '2-pagos'
  const sinPago = resumen.totalPendientes
  const meta = `${resumen.filas.length} reinscrito(s) · ${resumen.totalPagados} pagados · ${sinPago} pendientes`

  const bodyRows = resumen.filas
    .map((f) => {
      const cls = f.pagado ? 'alumno' : 'alumno sin-pago'
      if (dosPagos) {
        const d1 = f.fechaDif1
          ? escapeHtml(f.fechaDif1)
          : '<span class="badge-sin-pago">SIN PAGO</span>'
        const d2 = f.fechaDif2
          ? escapeHtml(f.fechaDif2)
          : '<span class="badge-sin-pago">SIN PAGO</span>'
        return `<tr class="${cls}">
          <td>${escapeHtml(String(f.no))}</td>
          <td>${escapeHtml(f.grado)}</td>
          <td>${escapeHtml(f.grupo)}</td>
          <td>${escapeHtml(f.noCtrl)}</td>
          <td>${escapeHtml(f.nombre)}</td>
          <td class="fecha-pago">${d1}</td>
          <td class="fecha-pago">${d2}</td>
          <td>${escapeHtml(f.plan)}</td>
        </tr>`
      }
      const fp = f.fechaPago
        ? escapeHtml(f.fechaPago)
        : '<span class="badge-sin-pago">SIN PAGO</span>'
      return `<tr class="${cls}">
        <td>${escapeHtml(String(f.no))}</td>
        <td>${escapeHtml(f.grado)}</td>
        <td>${escapeHtml(f.grupo)}</td>
        <td>${escapeHtml(f.noCtrl)}</td>
        <td>${escapeHtml(f.nombre)}</td>
        <td class="fecha-pago">${fp}</td>
        <td>${escapeHtml(f.plan)}</td>
      </tr>`
    })
    .join('')

  const head = dosPagos
    ? '<th>#</th><th>Grado</th><th>Grupo</th><th>No. Ctrl</th><th>Nombre</th><th>1er Dif</th><th>2do Dif</th><th>Plan</th>'
    : '<th>#</th><th>Grado</th><th>Grupo</th><th>No. Ctrl</th><th>Nombre</th><th>F. pago</th><th>Plan</th>'

  const resumenTabla = reinscritosResumenATabla(resumen)
  const resumenHead = resumenTabla.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
  const resumenBody = resumenTabla.rows
    .map((row, idx) => {
      const isTotal = idx === resumenTabla.rows.length - 1
      return `<tr${isTotal ? ' class="totales"' : ''}>${row
        .map((c) => `<td>${escapeHtml(c)}</td>`)
        .join('')}</tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(resumen.titulo)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm 10mm; }
    body { font-family: system-ui, sans-serif; color: #0f172a; background: #f8fafc; margin: 0; padding: 22px; }
    .hero {
      text-align: center; margin-bottom: 20px; padding: 18px 20px;
      background: linear-gradient(135deg, #0f2744, #1e3a5f); color: #fff; border-radius: 12px;
    }
    .hero h1 { margin: 0 0 6px; font-size: 1.45rem; }
    .hero p { margin: 0; opacity: 0.92; font-size: 0.9rem; }
    .hero .meta-pend { color: #fecaca; font-weight: 700; opacity: 1; }
    .block {
      background: #fff; border-radius: 10px; padding: 16px; margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,.08);
    }
    .block h2 { margin: 0 0 12px; font-size: 1rem; color: #334155; }
    .leyenda { margin: 0 0 12px; font-size: 12px; color: #475569; }
    .leyenda strong { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; font-weight: 700; }
    tr.alumno td { border-top: 1px solid #e2e8f0; }
    tr.alumno.sin-pago td { background: #fef2f2; }
    tr.alumno.sin-pago td.fecha-pago { font-weight: 800; color: #b91c1c; text-align: center; }
    .badge-sin-pago {
      display: inline-block; padding: 2px 8px; border-radius: 999px;
      background: #dc2626; color: #fff; font-size: 10px; font-weight: 800; letter-spacing: 0.04em;
    }
    tr.totales td { font-weight: 700; background: #f1f5f9; }
    .foot { text-align: center; font-size: 11px; color: #64748b; margin-top: 18px; }
  </style>
</head>
<body>
  <header class="hero">
    <h1>${escapeHtml(resumen.titulo)}</h1>
    <p>${escapeHtml(resumen.nivelLabel)} · ${escapeHtml(subtituloCiclo(resumen))}</p>
    <p style="margin-top:8px;font-size:0.8rem">
      ${escapeHtml(meta)}${
        sinPago > 0
          ? ` · <span class="meta-pend">${sinPago} sin pago objetivo</span>`
          : ''
      }
    </p>
  </header>
  <section class="block">
    <p class="leyenda">
      ${escapeHtml(leyendaConceptos(resumen.modo))}
      ${
        sinPago > 0
          ? ' <strong>SIN PAGO</strong> = pendiente del concepto objetivo del reporte.'
          : ''
      }
    </p>
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

export function generarPdfReporteReinscritos(resumen: ResumenReinscritosPagos): Buffer {
  const dosPagos = resumen.modo === '2-pagos'
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  let y = 12

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.setTextColor(15, 39, 68)
  pdf.text(resumen.titulo, pageW / 2, y, { align: 'center' })
  y += 6

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(71, 85, 105)
  pdf.text(`${resumen.nivelLabel} · ${subtituloCiclo(resumen)}`, pageW / 2, y, {
    align: 'center',
  })
  y += 5
  pdf.setFontSize(8)
  pdf.text(
    `${resumen.filas.length} reinscrito(s) · ${resumen.totalPagados} pagados · ${resumen.totalPendientes} pendientes`,
    pageW / 2,
    y,
    { align: 'center' }
  )
  y += 6

  const tabla = reinscritosPagosATabla(resumen, dosPagos)
  autoTable(pdf, {
    startY: y,
    head: [tabla.headers],
    body: tabla.rows,
    styles: { fontSize: 7, cellPadding: 1.2 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255 },
    margin: { left: 10, right: 10 },
    theme: 'striped',
    didParseCell: (data) => {
      if (data.section !== 'body' || !data.row.raw) return
      const raw = data.row.raw as string[]
      const tieneSinPago = raw.some((c) => String(c) === 'SIN PAGO')
      if (!tieneSinPago) return
      data.cell.styles.fillColor = [254, 226, 226]
      if (String(raw[data.column.index] ?? '') === 'SIN PAGO') {
        data.cell.styles.textColor = [185, 28, 28]
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.halign = 'center'
      }
    },
  })

  const resumenTabla = reinscritosResumenATabla(resumen)
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
    tableWidth: 90,
  })

  return Buffer.from(pdf.output('arraybuffer'))
}
