/**
 * 2026-08-13 - HTML/PDF del reporte cuota de inicio de curso (concepto 00).
 * Un documento por ciclo con secciones agrupadas por nivel.
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  fmtMontoCuotaInicio,
  type BloqueNivelCuotaInicio,
  type ResumenCuotaInicioCurso,
  type TotalesCuotaInicio,
} from '@/lib/reportes/cuotaInicioCursoService'
import { escapeHtml, fechaReporteMx } from '@/lib/reportes/renderDocument'

function statsHtml(t: TotalesCuotaInicio, compact = false): string {
  const cls = compact ? 'stats stats-compact' : 'stats'
  return `<div class="${cls}">
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
  </div>`
}

function tablaPagados(bloque: BloqueNivelCuotaInicio): string {
  if (!bloque.pagados.length) {
    return `<p class="empty">Nadie ha pagado aún la cuota de inicio en este nivel.</p>`
  }
  const rows = bloque.pagados
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
  return `<table>
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
    <tbody>${rows}</tbody>
  </table>`
}

function tablaDeudores(bloque: BloqueNivelCuotaInicio): string {
  if (!bloque.deudores.length) {
    return `<p class="empty">Todos los alumnos activos del nivel ya liquidaron la cuota de inicio.</p>`
  }
  const rows = bloque.deudores
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
  return `<table>
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
    <tbody>${rows}</tbody>
  </table>`
}

function seccionNivel(bloque: BloqueNivelCuotaInicio): string {
  const t = bloque.totales
  return `
  <section class="nivel" id="nivel-${bloque.nivel}">
    <header class="nivel-head">
      <div>
        <p class="nivel-eyebrow">Nivel</p>
        <h2>${escapeHtml(bloque.nivelLabel)}</h2>
      </div>
      <div class="nivel-chips">
        <span class="chip chip-ok">${t.pagados} pagaron</span>
        <span class="chip chip-warn">${t.conRecargo} con recargo</span>
        <span class="chip chip-debt">${t.deudores} deben</span>
        <span class="chip chip-teal">${escapeHtml(String(t.pctLiquidado))}% liquidado</span>
      </div>
    </header>
    ${statsHtml(t, true)}
    <div class="block block-ok">
      <h3>
        Ya pagaron
        <span class="pill pill-ok">${t.pagados}</span>
      </h3>
      ${tablaPagados(bloque)}
    </div>
    <div class="block block-debt">
      <h3>
        Deben la cuota
        <span class="pill pill-debt">${t.deudores}</span>
      </h3>
      ${tablaDeudores(bloque)}
    </div>
  </section>`
}

export function construirHtmlCuotaInicioCurso(resumen: ResumenCuotaInicioCurso): string {
  const t = resumen.totales
  const toc =
    resumen.niveles.length > 1
      ? `<nav class="toc">
      ${resumen.niveles
        .map(
          (n) =>
            `<a href="#nivel-${n.nivel}">${escapeHtml(n.nivelLabel)} <em>${n.totales.deudores} deben</em></a>`
        )
        .join('')}
    </nav>`
      : ''

  const secciones = resumen.niveles.map(seccionNivel).join('')
  const vacio =
    resumen.niveles.length === 0
      ? `<p class="empty empty-global">No hay alumnos activos en el ciclo ${escapeHtml(resumen.cicloLabel)}.</p>`
      : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(resumen.titulo)} · Ciclo ${escapeHtml(resumen.cicloLabel)}</title>
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
    .stats-compact { margin-bottom: 12px; }
    .stats-compact .stat { padding: 10px 10px 8px; }
    .stats-compact .stat .value { font-size: 1.15rem; }
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
    .toc {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0 0 16px;
    }
    .toc a {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: #fff;
      border: 1px solid var(--line);
      color: var(--ink);
      text-decoration: none;
      font-size: 0.82rem;
      font-weight: 700;
    }
    .toc a em {
      font-style: normal;
      color: var(--debt);
      font-size: 0.72rem;
      font-weight: 800;
    }
    .nivel {
      margin-bottom: 22px;
      padding: 16px;
      border-radius: 18px;
      background: rgba(255,255,255,0.55);
      border: 1px solid rgba(14, 116, 144, 0.12);
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
    }
    .nivel-head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 2px solid rgba(14, 116, 144, 0.18);
    }
    .nivel-eyebrow {
      margin: 0 0 2px;
      font-size: 0.68rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #0e7490;
      font-weight: 800;
    }
    .nivel-head h2 {
      margin: 0;
      font-size: 1.35rem;
      color: #0f766e;
    }
    .nivel-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      display: inline-flex;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 800;
    }
    .chip-ok { background: #d1fae5; color: #047857; }
    .chip-warn { background: #fef3c7; color: #b45309; }
    .chip-debt { background: #ffe4e6; color: #be123c; }
    .chip-teal { background: #cffafe; color: #0e7490; }
    .block {
      background: #fff;
      border-radius: 14px;
      padding: 14px;
      margin-bottom: 12px;
      box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .block:last-child { margin-bottom: 0; }
    .block h3 {
      margin: 0 0 10px;
      font-size: 1rem;
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
    .empty-global {
      text-align: center;
      padding: 24px;
      background: #fff;
      border-radius: 14px;
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
      .nivel { padding: 12px; }
      .nivel-head h2 { font-size: 1.15rem; }
    }
  </style>
</head>
<body>
  <header class="hero">
    <p class="eyebrow">Instituto Winston Churchill · Control escolar</p>
    <h1>${escapeHtml(resumen.titulo)}</h1>
    <p>Todos los niveles · Ciclo ${escapeHtml(resumen.cicloLabel)}</p>
    <p class="meta">Concepto 00 · alumnos activos · generado ${escapeHtml(fechaReporteMx())}</p>
  </header>

  ${statsHtml(t)}

  <p class="leyenda">
    Un solo reporte con Maternal, Kinder, Primaria y Secundaria agrupados.
    Monto = importe de la cuota. Recargo en columna aparte.
    Deudores: activos del ciclo sin pago vigente de concepto 00.
    Recaudado cuota: ${escapeHtml(fmtMontoCuotaInicio(t.montoPagado))} ·
    Recargos: ${escapeHtml(fmtMontoCuotaInicio(t.recargoPagado))}.
  </p>

  ${toc}
  ${secciones}
  ${vacio}

  <p class="foot">Servicios Admin · Winston · Cuota inicio de curso (00)</p>
</body>
</html>`
}

function pdfStatsLine(t: TotalesCuotaInicio): string {
  return `Alumnos ${t.alumnos} · Pagaron ${t.pagados} · Con recargo ${t.conRecargo} · Deben ${t.deudores} · Liquidado ${t.pctLiquidado}%`
}

export function generarPdfCuotaInicioCurso(resumen: ResumenCuotaInicioCurso): Buffer {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const t = resumen.totales
  let y = 14
  let firstPage = true

  const ensureSpace = (needed: number) => {
    if (y + needed > 190) {
      pdf.addPage()
      y = 16
    }
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.setTextColor(14, 116, 144)
  pdf.text(resumen.titulo, 148, y, { align: 'center' })
  y += 7

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(71, 85, 105)
  pdf.text(`Todos los niveles · Ciclo ${resumen.cicloLabel} · Concepto 00`, 148, y, {
    align: 'center',
  })
  y += 6
  pdf.setFontSize(8)
  pdf.text(pdfStatsLine(t), 148, y, { align: 'center' })
  y += 10

  if (resumen.niveles.length === 0) {
    pdf.setFontSize(11)
    pdf.text(`Sin alumnos activos en el ciclo ${resumen.cicloLabel}.`, 148, y, {
      align: 'center',
    })
    return Buffer.from(pdf.output('arraybuffer'))
  }

  for (const bloque of resumen.niveles) {
    if (!firstPage) {
      pdf.addPage()
      y = 16
    }
    firstPage = false

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    pdf.setTextColor(15, 118, 110)
    pdf.text(bloque.nivelLabel, 14, y)
    y += 5
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(71, 85, 105)
    pdf.text(pdfStatsLine(bloque.totales), 14, y)
    y += 6

    ensureSpace(20)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(4, 120, 87)
    pdf.text(`Ya pagaron (${bloque.totales.pagados})`, 14, y)
    y += 3

    autoTable(pdf, {
      startY: y,
      head: [['#', 'No. Ctrl', 'Nombre', 'Grado', 'Gpo', 'Fecha', 'Monto', 'Recargo', 'Total']],
      body: bloque.pagados.map((f) => [
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
      ((pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) +
      10

    ensureSpace(24)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(190, 18, 60)
    pdf.text(`Deben la cuota (${bloque.totales.deudores})`, 14, y)
    y += 3

    autoTable(pdf, {
      startY: y,
      head: [['#', 'No. Ctrl', 'Nombre', 'Grado', 'Grupo', 'Tipo']],
      body: bloque.deudores.map((f) => [
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

    y =
      ((pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) +
      8
  }

  return Buffer.from(pdf.output('arraybuffer'))
}
