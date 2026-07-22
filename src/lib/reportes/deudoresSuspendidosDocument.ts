import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { escapeHtml, fechaReporteMx } from './renderDocument'

export type FilaDeudorReporte = {
  no: number
  noCtrl: string
  nombre: string
  nivel: string
  gradoEtiqueta: string
  modalidad: string
  planMes: number | null
  adeudos: string
  prorroga: string
}

export type ResumenDeudoresReporte = {
  titulo: string
  cicloLabel: string
  tipo: 2 | 3
  plantel: 1 | 2
  filas: FilaDeudorReporte[]
  totalRevisados: number
  excluidosBecados100: number
}

function chipsAdeudosHtml(adeudos: string): string {
  const parts = adeudos
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!parts.length) return escapeHtml(adeudos)
  return parts
    .map((p) => `<span class="chip chip-adeudo">${escapeHtml(p)}</span>`)
    .join(' ')
}

function badgeModalidadHtml(planMes: number | null, label: string): string {
  const cls =
    planMes === 1 ? 'badge-10' : planMes === 2 ? 'badge-11' : 'badge-nd'
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`
}

export function construirHtmlDeudoresSuspendidos(resumen: ResumenDeudoresReporte): string {
  const tono = resumen.tipo === 2 ? 'amber' : 'rose'
  const leyenda =
    resumen.tipo === 2
      ? 'Deudores desde 1 colegiatura pendiente · plan 10 meses hasta junio · plan 11 meses hasta julio · becados al 100% excluidos (no pagan colegiatura)'
      : 'Suspendidos: 2 o más colegiaturas pendientes · plan 10 meses hasta junio · plan 11 meses hasta julio · becados al 100% excluidos (no pagan colegiatura)'

  const rows = resumen.filas
    .map(
      (f) => `
      <tr>
        <td class="num">${escapeHtml(String(f.no))}</td>
        <td class="ctrl">${escapeHtml(f.noCtrl)}</td>
        <td class="nombre">${escapeHtml(f.nombre)}</td>
        <td>${escapeHtml(f.nivel)}</td>
        <td>${escapeHtml(f.gradoEtiqueta)}</td>
        <td class="mod">${badgeModalidadHtml(f.planMes, f.modalidad)}</td>
        <td class="adeudos">${chipsAdeudosHtml(f.adeudos)}</td>
        <td class="prorroga">${escapeHtml(f.prorroga || '—')}</td>
      </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(resumen.titulo)}</title>
  <style>
    @page { size: A4; margin: 12mm 10mm; }
    :root {
      --ink: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --hero-a: ${tono === 'amber' ? '#92400e' : '#9f1239'};
      --hero-b: ${tono === 'amber' ? '#b45309' : '#be123c'};
      --head: ${tono === 'amber' ? '#fff7ed' : '#fff1f2'};
      --head-ink: ${tono === 'amber' ? '#9a3412' : '#9f1239'};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      font-family: "Segoe UI", system-ui, sans-serif;
      color: var(--ink);
      background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
    }
    .hero {
      text-align: center;
      margin-bottom: 18px;
      padding: 22px 18px;
      border-radius: 14px;
      color: #fff;
      background: linear-gradient(135deg, var(--hero-a), var(--hero-b));
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.18);
    }
    .hero h1 { margin: 0 0 6px; font-size: 1.45rem; letter-spacing: 0.01em; }
    .hero p { margin: 0; opacity: 0.92; font-size: 0.92rem; }
    .hero .meta { margin-top: 10px; font-size: 0.78rem; opacity: 0.88; }
    .leyenda {
      margin: 0 0 14px;
      padding: 10px 14px;
      border-radius: 10px;
      background: #fff;
      border: 1px solid var(--line);
      color: var(--muted);
      font-size: 0.8rem;
      line-height: 1.4;
    }
    .block {
      background: #fff;
      border-radius: 12px;
      padding: 12px;
      box-shadow: 0 2px 10px rgba(15, 23, 42, 0.06);
      overflow-x: auto;
    }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border-bottom: 1px solid var(--line); padding: 8px 7px; text-align: left; vertical-align: middle; }
    th {
      background: var(--head);
      color: var(--head-ink);
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      position: sticky;
      top: 0;
    }
    tr:nth-child(even) td { background: #fafafa; }
    tr:hover td { background: ${tono === 'amber' ? '#fffbeb' : '#fff1f2'}; }
    .num { width: 28px; color: var(--muted); text-align: center; }
    .ctrl { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
    .nombre { min-width: 160px; font-weight: 600; }
    .mod { white-space: nowrap; }
    .adeudos { min-width: 140px; }
    .prorroga { white-space: nowrap; color: var(--muted); font-size: 11px; }
    .badge {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .badge-10 { background: #dbeafe; color: #1d4ed8; }
    .badge-11 { background: #d1fae5; color: #047857; }
    .badge-nd { background: #f1f5f9; color: #64748b; }
    .chip {
      display: inline-block;
      margin: 1px 2px;
      padding: 2px 7px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
    }
    .chip-adeudo {
      background: ${tono === 'amber' ? '#ffedd5' : '#ffe4e6'};
      color: ${tono === 'amber' ? '#c2410c' : '#be123c'};
    }
    .foot {
      text-align: center;
      font-size: 11px;
      color: var(--muted);
      margin-top: 18px;
    }
  </style>
</head>
<body>
  <header class="hero">
    <h1>${escapeHtml(resumen.titulo)}</h1>
    <p>Ciclo ${escapeHtml(resumen.cicloLabel)}</p>
    <p class="meta">${resumen.filas.length} deudor(es) · ${resumen.totalRevisados} revisados${
      resumen.excluidosBecados100 > 0
        ? ` · ${resumen.excluidosBecados100} becado(s) 100% excluidos`
        : ''
    }</p>
  </header>
  <p class="leyenda">${escapeHtml(leyenda)}</p>
  <section class="block">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>No. Ctrl</th>
          <th>Nombre</th>
          <th>Nivel</th>
          <th>Grado</th>
          <th>Modalidad</th>
          <th>Adeudos</th>
          <th>Prórroga</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="8" style="text-align:center;color:#64748b;padding:24px">Sin deudores en este ciclo.</td></tr>`}
      </tbody>
    </table>
  </section>
  <p class="foot">Generado en Servicios Admin · ${escapeHtml(fechaReporteMx())}</p>
</body>
</html>`
}

export function generarPdfDeudoresSuspendidos(resumen: ResumenDeudoresReporte): Buffer {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const headColor: [number, number, number] =
    resumen.tipo === 2 ? [180, 83, 9] : [190, 18, 60]

  let y = 14
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.setTextColor(15, 23, 42)
  pdf.text(resumen.titulo, 148, y, { align: 'center' })
  y += 6
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(71, 85, 105)
  pdf.text(`Ciclo ${resumen.cicloLabel}`, 148, y, { align: 'center' })
  y += 5
  pdf.setFontSize(8)
  pdf.text(
    `${resumen.filas.length} deudor(es) · ${resumen.totalRevisados} revisados · 10→jun · 11→jul · sin becados 100%`,
    148,
    y,
    { align: 'center' }
  )
  y += 4

  autoTable(pdf, {
    startY: y,
    head: [['#', 'No. Ctrl', 'Nombre', 'Nivel', 'Grado', 'Modalidad', 'Adeudos', 'Prórroga']],
    body: resumen.filas.map((f) => [
      String(f.no),
      f.noCtrl,
      f.nombre,
      f.nivel,
      f.gradoEtiqueta,
      f.modalidad,
      f.adeudos,
      f.prorroga || '—',
    ]),
    styles: { fontSize: 7.5, cellPadding: 1.6, valign: 'middle' },
    headStyles: { fillColor: headColor, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 22 },
      2: { cellWidth: 70 },
      3: { cellWidth: 24 },
      4: { cellWidth: 28 },
      5: { cellWidth: 24, halign: 'center' },
      6: { cellWidth: 70 },
      7: { cellWidth: 28 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 5) return
      const raw = String(data.cell.raw ?? '')
      if (raw.includes('10')) {
        data.cell.styles.textColor = [29, 78, 216]
        data.cell.styles.fontStyle = 'bold'
      } else if (raw.includes('11')) {
        data.cell.styles.textColor = [4, 120, 87]
        data.cell.styles.fontStyle = 'bold'
      }
    },
    margin: { left: 10, right: 10 },
  })

  return Buffer.from(pdf.output('arraybuffer'))
}
