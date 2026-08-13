/**
 * 2026-08-13 - HTML/PDF del reporte cuota de inicio de curso (concepto 00).
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  fmtMontoCuotaInicio,
  type ResumenCuotaInicioCurso,
} from '@/lib/reportes/cuotaInicioCursoService'
import { escapeHtml, fechaReporteMx } from '@/lib/reportes/renderDocument'

export function construirHtmlCuotaInicioCurso(resumen: ResumenCuotaInicioCurso): string {
  const t = resumen.totales
  const rowsPagados = resumen.pagados
    .map(
      (f) => `
      <tr class="${f.conRecargo ? 'row-recargo' : ''}">
        <td class="num">${escapeHtml(String(f.no))}</td>
        <td class="ctrl">${escapeHtml(f.noCtrl)}</td>
        <td class="nombre">${escapeHtml(f.nombre)}</td>
        <td>${escapeHtml(f.grado)}</td>
        <td>${escapeHtml(f.grupo)}</td>
        <td class="fecha">${escapeHtml(f.fechaPago || '—')}</td>
        <td class="money">${escapeHtml(fmtMontoCuotaInicio(f.monto))}</td>
        <td class="money ${f.conRecargo ? 'recargo' : 'muted'}">${escapeHtml(
          fmtMontoCuotaInicio(f.recargo)
        )}</td>
        <td class="money total">${escapeHtml(fmtMontoCuotaInicio(f.total))}</td>
      </tr>`
    )
    .join('')

  const rowsDeudores = resumen.deudores
    .map(
      (f) => `
      <tr>
        <td class="num">${escapeHtml(String(f.no))}</td>
        <td class="ctrl">${escapeHtml(f.noCtrl)}</td>
        <td class="nombre">${escapeHtml(f.nombre)}</td>
        <td>${escapeHtml(f.grado)}</td>
        <td>${escapeHtml(f.grupo)}</td>
        <td><span class="badge badge-tipo">${escapeHtml(f.tipoIngreso)}</span></td>
      </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(resumen.titulo)} · ${escapeHtml(resumen.nivelLabel)}</title>
  <style>
    @page { size: A4; margin: 11mm 9mm; }
    :root {
      --ink: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --ok: #047857;
      --warn: #b45309;
      --debt: #be123c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 18px;
      font-family: "Segoe UI", system-ui, sans-serif;
      color: var(--ink);
      background: linear-gradient(165deg, #f8fafc 0%, #ecfeff 45%, #f0fdf4 100%);
    }
    .hero {
      text-align: center;
      margin-bottom: 16px;
      padding: 22px 16px;
      border-radius: 16px;
      color: #fff;
      background: linear-gradient(135deg, #0e7490 0%, #155e75 42%, #0f766e 100%);
      box-shadow: 0 12px 30px rgba(14, 116, 144, 0.28);
    }
    .hero .eyebrow {
      margin: 0 0 6px;
      font-size: 0.72rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      opacity: 0.88;
      font-weight: 700;
    }
    .hero h1 { margin: 0 0 6px; font-size: 1.55rem; letter-spacing: 0.01em; }
    .hero p { margin: 0; opacity: 0.93; font-size: 0.95rem; }
    .hero .meta { margin-top: 10px; font-size: 0.78rem; opacity: 0.86; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }
    .stat {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px 12px 10px;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
    }
    .stat .label {
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      font-weight: 700;
    }
    .stat .value {
      margin-top: 4px;
      font-size: 1.35rem;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .stat.ok .value { color: var(--ok); }
    .stat.warn .value { color: var(--warn); }
    .stat.debt .value { color: var(--debt); }
    .stat.teal .value { color: #0e7490; }
    .leyenda {
      margin: 0 0 14px;
      padding: 10px 14px;
      border-radius: 10px;
      background: #fff;
      border: 1px solid var(--line);
      color: var(--muted);
      font-size: 0.8rem;
      line-height: 1.45;
    }
    .block {
      background: #fff;
      border-radius: 14px;
      padding: 14px;
      margin-bottom: 14px;
      box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .block h2 {
      margin: 0 0 10px;
      font-size: 1.02rem;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.03em;
    }
    .pill-ok { background: #d1fae5; color: #047857; }
    .pill-debt { background: #ffe4e6; color: #be123c; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; min-width: 640px; }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 8px 7px;
      text-align: left;
      vertical-align: middle;
    }
    th {
      font-weight: 800;
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      position: sticky;
      top: 0;
    }
    .block-ok th { background: #ecfdf5; color: #065f46; }
    .block-debt th { background: #fff1f2; color: #9f1239; }
    tr:nth-child(even) td { background: #fafafa; }
    .block-ok tr:hover td { background: #f0fdf4; }
    .block-debt tr:hover td { background: #fff1f2; }
    .row-recargo td { background: #fffbeb !important; }
    .num { width: 28px; color: var(--muted); text-align: center; }
    .ctrl { font-variant-numeric: tabular-nums; font-weight: 700; white-space: nowrap; }
    .nombre { min-width: 150px; font-weight: 600; }
    .fecha { white-space: nowrap; font-variant-numeric: tabular-nums; }
    .money {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      font-weight: 600;
    }
    .money.recargo { color: var(--warn); }
    .money.muted { color: var(--muted); font-weight: 500; }
    .money.total { font-weight: 800; }
    .badge-tipo {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      background: #e0f2fe;
      color: #0369a1;
    }
    .empty {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: 0.88rem;
    }
    .foot {
      text-align: center;
      font-size: 11px;
      color: var(--muted);
      margin-top: 8px;
    }
    @media (max-width: 640px) {
      body { padding: 12px; }
      .hero h1 { font-size: 1.25rem; }
      .stat .value { font-size: 1.15rem; }
    }
  </style>
</head>
<body>
  <header class="hero">
    <p class="eyebrow">Instituto Winston Churchill · Control escolar</p>
    <h1>${escapeHtml(resumen.titulo)}</h1>
    <p>${escapeHtml(resumen.nivelLabel)} · Ciclo ${escapeHtml(resumen.cicloLabel)}</p>
    <p class="meta">Concepto 00 · alumnos activos del nivel · generado ${escapeHtml(fechaReporteMx())}</p>
  </header>

  <div class="stats">
    <div class="stat teal">
      <div class="label">Alumnos</div>
      <div class="value">${t.alumnos}</div>
    </div>
    <div class="stat ok">
      <div class="label">Pagaron</div>
      <div class="value">${t.pagados}</div>
    </div>
    <div class="stat warn">
      <div class="label">Con recargo</div>
      <div class="value">${t.conRecargo}</div>
    </div>
    <div class="stat debt">
      <div class="label">Deben</div>
      <div class="value">${t.deudores}</div>
    </div>
    <div class="stat teal">
      <div class="label">% liquidado</div>
      <div class="value">${escapeHtml(String(t.pctLiquidado))}%</div>
    </div>
  </div>

  <p class="leyenda">
    Monto = importe de la cuota. Recargo se muestra en columna aparte (solo si el pago lo incluyó).
    Deudores: activos del nivel en el ciclo sin pago vigente de concepto 00.
    Recaudado cuota: ${escapeHtml(fmtMontoCuotaInicio(t.montoPagado))} ·
    Recargos: ${escapeHtml(fmtMontoCuotaInicio(t.recargoPagado))}.
  </p>

  <section class="block block-ok">
    <h2>
      Ya pagaron
      <span class="pill pill-ok">${t.pagados}</span>
    </h2>
    ${
      resumen.pagados.length
        ? `<table>
      <thead>
        <tr>
          <th>#</th>
          <th>No. Ctrl</th>
          <th>Nombre</th>
          <th>Grado</th>
          <th>Grupo</th>
          <th>Fecha</th>
          <th>Monto</th>
          <th>Recargo</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>${rowsPagados}</tbody>
    </table>`
        : `<p class="empty">Nadie ha pagado aún la cuota de inicio en este nivel/ciclo.</p>`
    }
  </section>

  <section class="block block-debt">
    <h2>
      Deben la cuota
      <span class="pill pill-debt">${t.deudores}</span>
    </h2>
    ${
      resumen.deudores.length
        ? `<table>
      <thead>
        <tr>
          <th>#</th>
          <th>No. Ctrl</th>
          <th>Nombre</th>
          <th>Grado</th>
          <th>Grupo</th>
          <th>Tipo</th>
        </tr>
      </thead>
      <tbody>${rowsDeudores}</tbody>
    </table>`
        : `<p class="empty">Todos los alumnos activos del nivel ya liquidaron la cuota de inicio.</p>`
    }
  </section>

  <p class="foot">Servicios Admin · Winston · Cuota inicio de curso (00)</p>
</body>
</html>`
}

export function generarPdfCuotaInicioCurso(resumen: ResumenCuotaInicioCurso): Buffer {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const t = resumen.totales
  let y = 14

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.setTextColor(14, 116, 144)
  pdf.text(resumen.titulo, 148, y, { align: 'center' })
  y += 7

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(71, 85, 105)
  pdf.text(
    `${resumen.nivelLabel} · Ciclo ${resumen.cicloLabel} · Concepto 00`,
    148,
    y,
    { align: 'center' }
  )
  y += 6
  pdf.setFontSize(8)
  pdf.text(
    `Alumnos ${t.alumnos} · Pagaron ${t.pagados} · Con recargo ${t.conRecargo} · Deben ${t.deudores} · Liquidado ${t.pctLiquidado}%`,
    148,
    y,
    { align: 'center' }
  )
  y += 8

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(4, 120, 87)
  pdf.text(`Ya pagaron (${t.pagados})`, 14, y)
  y += 3

  autoTable(pdf, {
    startY: y,
    head: [['#', 'No. Ctrl', 'Nombre', 'Grado', 'Gpo', 'Fecha', 'Monto', 'Recargo', 'Total']],
    body: resumen.pagados.map((f) => [
      String(f.no),
      f.noCtrl,
      f.nombre,
      f.grado,
      f.grupo,
      f.fechaPago || '—',
      fmtMontoCuotaInicio(f.monto),
      fmtMontoCuotaInicio(f.recargo),
      fmtMontoCuotaInicio(f.total),
    ]),
    styles: { fontSize: 7.5, cellPadding: 1.4 },
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  })

  y =
    ((pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10

  if (y > 170) {
    pdf.addPage()
    y = 16
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(190, 18, 60)
  pdf.text(`Deben la cuota (${t.deudores})`, 14, y)
  y += 3

  autoTable(pdf, {
    startY: y,
    head: [['#', 'No. Ctrl', 'Nombre', 'Grado', 'Grupo', 'Tipo']],
    body: resumen.deudores.map((f) => [
      String(f.no),
      f.noCtrl,
      f.nombre,
      f.grado,
      f.grupo,
      f.tipoIngreso,
    ]),
    styles: { fontSize: 7.5, cellPadding: 1.4 },
    headStyles: { fillColor: [244, 63, 94], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [255, 241, 242] },
    margin: { left: 14, right: 14 },
  })

  return Buffer.from(pdf.output('arraybuffer'))
}
