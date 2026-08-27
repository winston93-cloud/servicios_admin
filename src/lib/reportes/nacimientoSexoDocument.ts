import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ResumenNacimientoSexo } from './nacimientoSexoService'
import { escapeHtml, fechaReporteMx } from './renderDocument'

export function construirHtmlReporteNacimientoSexo(resumen: ResumenNacimientoSexo): string {
  const bloques = resumen.grupos
    .map((g) => {
      const rows = g.filas
        .map(
          (f) => `<tr>
            <td class="num">${escapeHtml(String(f.no))}</td>
            <td class="nombre">${escapeHtml(f.nombre)}</td>
            <td class="fecha">${escapeHtml(f.fechaNac)}</td>
            <td class="sexo"><span class="pill pill-${f.sexoCodigo === 'M' ? 'f' : f.sexoCodigo === 'H' ? 'm' : 'x'}">${escapeHtml(f.sexo)}</span></td>
            <td class="curp">${escapeHtml(f.curp)}</td>
          </tr>`
        )
        .join('')

      return `
      <section class="grado-block">
        <div class="grado-head">
          <h2>${escapeHtml(g.gradoLabel)}</h2>
          <span class="count">${g.filas.length} alumno${g.filas.length === 1 ? '' : 's'}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th class="num">#</th>
              <th>Nombre completo</th>
              <th>Fecha de nacimiento</th>
              <th>Sexo</th>
              <th>CURP</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="5" class="empty">Sin alumnos en este grado</td></tr>`}</tbody>
        </table>
      </section>`
    })
    .join('')

  const resumenChips = resumen.grupos
    .map(
      (g) =>
        `<div class="chip"><strong>${escapeHtml(g.gradoLabel)}</strong><span>${g.filas.length}</span></div>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(resumen.titulo)} · ${escapeHtml(resumen.nivelLabel)}</title>
  <style>
    @page { size: A4; margin: 12mm 11mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      color: #0f172a;
      background: #eef2f7;
      margin: 0;
      padding: 22px;
    }
    .sheet {
      max-width: 920px;
      margin: 0 auto;
    }
    .hero {
      position: relative;
      overflow: hidden;
      text-align: center;
      margin-bottom: 18px;
      padding: 26px 22px 22px;
      border-radius: 18px;
      color: #fff;
      background:
        radial-gradient(120% 90% at 100% -10%, rgba(56, 189, 248, 0.35), transparent 55%),
        radial-gradient(90% 80% at -10% 110%, rgba(251, 191, 36, 0.22), transparent 50%),
        linear-gradient(145deg, #0b1f36 0%, #143456 48%, #0f2744 100%);
      box-shadow: 0 18px 40px rgba(15, 39, 68, 0.28);
    }
    .hero::after {
      content: "";
      position: absolute;
      inset: auto -20% -40% auto;
      width: 280px;
      height: 280px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%);
      pointer-events: none;
    }
    .brand {
      margin: 0 0 8px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #fde68a;
    }
    .hero h1 {
      position: relative;
      margin: 0 0 8px;
      font-size: 1.55rem;
      letter-spacing: -0.02em;
      line-height: 1.15;
    }
    .hero p { position: relative; margin: 0; opacity: 0.92; font-size: 0.95rem; }
    .meta {
      position: relative;
      display: inline-flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
      margin-top: 14px;
    }
    .meta span {
      display: inline-flex;
      align-items: center;
      padding: 5px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.18);
      font-size: 0.78rem;
      font-weight: 600;
    }
    .resumen {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 12px;
      background: #fff;
      border: 1px solid #dbe3ef;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      font-size: 0.8rem;
    }
    .chip strong { color: #1e3a5f; font-weight: 700; }
    .chip span {
      min-width: 1.6rem;
      text-align: center;
      padding: 2px 7px;
      border-radius: 999px;
      background: #e0f2fe;
      color: #075985;
      font-weight: 800;
      font-size: 0.75rem;
    }
    .grado-block {
      background: #fff;
      border-radius: 14px;
      padding: 14px 14px 10px;
      margin-bottom: 14px;
      border: 1px solid #dbe3ef;
      box-shadow: 0 8px 24px rgba(15, 39, 68, 0.06);
      break-inside: avoid;
    }
    .grado-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }
    .grado-head h2 {
      margin: 0;
      font-size: 1.05rem;
      color: #0f2744;
      letter-spacing: -0.01em;
    }
    .grado-head .count {
      font-size: 0.75rem;
      font-weight: 700;
      color: #0369a1;
      background: #e0f2fe;
      padding: 4px 10px;
      border-radius: 999px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #eef2f7; }
    th {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
      background: #f8fafc;
      font-weight: 700;
    }
    td.num, th.num { width: 42px; text-align: center; color: #94a3b8; font-variant-numeric: tabular-nums; }
    td.nombre { font-weight: 650; color: #0f172a; }
    td.fecha { font-variant-numeric: tabular-nums; color: #334155; white-space: nowrap; }
    td.curp {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      letter-spacing: 0.02em;
      color: #1e3a5f;
      white-space: nowrap;
    }
    td.empty { text-align: center; color: #94a3b8; padding: 18px; }
    tr:nth-child(even) td { background: #fafbfd; }
    .pill {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 750;
      letter-spacing: 0.02em;
    }
    .pill-m { background: #dbeafe; color: #1d4ed8; }
    .pill-f { background: #fce7f3; color: #be185d; }
    .pill-x { background: #f1f5f9; color: #64748b; }
    .foot {
      text-align: center;
      font-size: 11px;
      color: #64748b;
      margin-top: 18px;
      padding-top: 8px;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .hero { box-shadow: none; }
      .grado-block { box-shadow: none; break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="hero">
      <p class="brand">Instituto Winston Churchill · Servicios Admin</p>
      <h1>${escapeHtml(resumen.titulo)}</h1>
      <p>${escapeHtml(resumen.nivelLabel)} · Ciclo escolar ${escapeHtml(resumen.cicloLabel)}</p>
      <div class="meta">
        <span>${resumen.total} alumno${resumen.total === 1 ? '' : 's'}</span>
        <span>${resumen.grupos.length} grado${resumen.grupos.length === 1 ? '' : 's'}</span>
      </div>
    </header>
    ${resumen.grupos.length ? `<div class="resumen">${resumenChips}</div>` : ''}
    ${
      bloques ||
      `<section class="grado-block"><p class="empty" style="text-align:center;padding:28px;color:#64748b">No hay alumnos activos en este nivel para el ciclo.</p></section>`
    }
    <p class="foot">Reporte institucional · Generado ${escapeHtml(fechaReporteMx())}</p>
  </div>
</body>
</html>`
}

export function generarPdfReporteNacimientoSexo(resumen: ResumenNacimientoSexo): Buffer {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const marginX = 12
  let y = 14

  pdf.setFillColor(11, 31, 54)
  pdf.roundedRect(marginX, y, 186, 28, 3, 3, 'F')
  pdf.setTextColor(253, 230, 138)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.text('INSTITUTO WINSTON CHURCHILL · SERVICIOS ADMIN', 105, y + 8, { align: 'center' })
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(14)
  pdf.text(resumen.titulo, 105, y + 16, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(
    `${resumen.nivelLabel} · Ciclo ${resumen.cicloLabel} · ${resumen.total} alumno(s)`,
    105,
    y + 23,
    { align: 'center' }
  )
  y += 34

  for (const g of resumen.grupos) {
    if (y > 250) {
      pdf.addPage()
      y = 16
    }

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(15, 39, 68)
    pdf.text(g.gradoLabel, marginX, y)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(3, 105, 161)
    pdf.text(`${g.filas.length} alumno(s)`, 198 - marginX, y, { align: 'right' })
    y += 3

    autoTable(pdf, {
      startY: y,
      head: [['#', 'Nombre completo', 'Fecha de nacimiento', 'Sexo', 'CURP']],
      body: g.filas.map((f) => [String(f.no), f.nombre, f.fechaNac, f.sexo, f.curp]),
      styles: { fontSize: 7.5, cellPadding: 1.5, textColor: [15, 23, 42] },
      headStyles: {
        fillColor: [15, 39, 68],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 62 },
        2: { cellWidth: 32, halign: 'center' },
        3: { cellWidth: 28, halign: 'center' },
        4: { cellWidth: 54, fontSize: 6.5, font: 'courier' },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: marginX, right: marginX },
      theme: 'grid',
    })

    y =
      ((pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8
  }

  const pageCount =
    (pdf as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setFontSize(7)
    pdf.setTextColor(100, 116, 139)
    pdf.text(
      `Reporte institucional · ${fechaReporteMx()} · p. ${i}/${pageCount}`,
      105,
      290,
      { align: 'center' }
    )
  }

  return Buffer.from(pdf.output('arraybuffer'))
}
