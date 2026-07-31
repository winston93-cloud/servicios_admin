import type { ReporteBecadosResumen } from './reporteBecadosService'
import { cicloEscolarEtiqueta } from './ciclosEscolares'

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Legacy corto `22-23`. Preferir `etiquetaCicloEscolarAnios` en reportes. */
export function etiquetaCicloLargo(ciclo: number): string {
  return `${ciclo}-${ciclo + 1}`
}

/** Ej. ciclo 22 → `2025-2026` (avanza con la temporada). */
export function etiquetaCicloEscolarAnios(ciclo: number): string {
  return cicloEscolarEtiqueta(ciclo)
}

export function tituloReporteBecadosPromedio(): string {
  return 'Becados Promedio > 9'
}

export function subtituloCicloEscolarBecados(cicloDatos: number): string {
  // Encabezado = temporada vigente (ficha). Datos del reporte = beca/califs del ciclo
  // seleccionado, que suele ser el anterior (ej. datos 22 → encabezado 2026-2027).
  return `Ciclo Escolar ${etiquetaCicloEscolarAnios(cicloDatos + 1)}`
}

export function construirHtmlReporteBecados(
  resumen: ReporteBecadosResumen,
  opciones?: { titulo?: string; etiquetaTotal?: string }
): string {
  const conPromedio = Boolean(resumen.conPromedio)
  const soloPromedioWinston = conPromedio && resumen.nivelFiltro === 4
  const titulo =
    opciones?.titulo ?? (conPromedio ? tituloReporteBecadosPromedio() : 'Alumnos becados')
  const etiquetaTotal =
    opciones?.etiquetaTotal ?? (conPromedio ? 'Becados > 9' : 'Becados activos')
  const cicloLabel = subtituloCicloEscolarBecados(resumen.ciclo)
  const fecha = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  if (resumen.nota && resumen.total === 0) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(titulo)} · ${escapeHtml(cicloLabel)} — Servicios Admin</title>
  <style>
    body { font-family: system-ui, sans-serif; background:#f8fafc; color:#0f172a; padding:40px 24px; }
    .box { max-width:560px; margin:0 auto; background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:28px; }
    h1 { font-size:22px; margin:0 0 8px; }
    p { color:#475569; line-height:1.5; margin:0; }
  </style>
</head>
<body>
  <div class="box">
    <h1>${escapeHtml(titulo)}</h1>
    <p>${escapeHtml(resumen.nota)}</p>
    <p style="margin-top:12px;font-size:13px;color:#94a3b8">${escapeHtml(cicloLabel)} · ${escapeHtml(resumen.nivelFiltroLabel ?? '')}</p>
  </div>
</body>
</html>`
  }

  const fmt = (n: number | null | undefined) =>
    n == null || Number.isNaN(n) ? '—' : n.toFixed(1)

  const fmtMonto = (n: number | null | undefined) =>
    n == null || Number.isNaN(n)
      ? ''
      : `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const tagsBeca = (a: (typeof resumen.filas)[number]) => {
    const tags: string[] = []
    // SEP vigente (open_house / enlinea3) reemplaza a Winston residual.
    const muestraSep = a.origenBeca === 'sep' || Boolean(a.tieneSep)
    const muestraWinston = a.origenBeca === 'winston' && !muestraSep

    if (muestraWinston) {
      const w =
        a.tiposWinston && a.tiposWinston.length > 0
          ? `Winston (${a.tiposWinston.join(', ')})`
          : 'Winston'
      tags.push(`<span class="beca-tag winston">${escapeHtml(w)}</span>`)
    }
    if (muestraSep) {
      const sepLabel =
        a.montoSep != null && a.montoSep > 0 ? `SEP (${fmtMonto(a.montoSep)})` : 'SEP'
      tags.push(`<span class="beca-tag sep">${escapeHtml(sepLabel)}</span>`)
    }
    if (tags.length === 0) {
      tags.push(`<span class="beca-tag">${escapeHtml(a.becaClase)}</span>`)
    }
    return `<div class="beca-tags">${tags.join(' ')}</div>`
  }

  const pctCell = (a: (typeof resumen.filas)[number]) => {
    if (a.origenBeca === 'sep' || a.tieneSep) {
      return a.montoSep != null && a.montoSep > 0 ? fmtMonto(a.montoSep) : '—'
    }
    if (a.becaPorcentaje > 0) return `${a.becaPorcentaje}%`
    return '—'
  }

  const sections = resumen.gruposPorNivel
    .map(({ nivel, nivelLabel, plantel, filas }) => {
      const rows = filas
        .map(
          (a, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td class="name">${escapeHtml(a.nombre)}</td>
          <td><span class="pill nivel-${nivel}">${escapeHtml(a.grado)}</span></td>
          <td class="grp">${escapeHtml(a.grupo)}</td>
          <td>${tagsBeca(a)}</td>
          <td class="pct">${pctCell(a)}</td>
          ${
            conPromedio
              ? soloPromedioWinston
                ? `<td class="avg strong">${fmt(a.promedio)}</td>`
                : `<td class="avg">${fmt(a.promedioEs)}</td>
          <td class="avg">${fmt(a.promedioEn)}${a.letraEn ? ` <span class="letra">(${escapeHtml(a.letraEn)})</span>` : ''}</td>
          <td class="avg strong">${fmt(a.promedio)}</td>`
              : ''
          }
        </tr>`
        )
        .join('')

      return `
      <section class="block">
        <div class="block-head">
          <div>
            <p class="eyebrow">${escapeHtml(plantel)}</p>
            <h2>${escapeHtml(nivelLabel)}</h2>
          </div>
          <div class="count">${filas.length} becado${filas.length === 1 ? '' : 's'}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Nombre completo</th>
              <th>Grado</th>
              <th>Grupo</th>
              <th>Tipo de beca</th>
              <th>% / monto</th>
              ${
                conPromedio
                  ? soloPromedioWinston
                    ? '<th>Promedio</th>'
                    : '<th>Prom. ES</th><th>Prom. EN</th><th>Promedio</th>'
                  : ''
              }
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`
    })
    .join('')

  const footerExtra = conPromedio
    ? soloPromedioWinston
      ? ' · Promedio Final Winston del ciclo de datos (grado anterior a la ficha; 7mo ← 6° Primaria) · umbral ≥ 9 · Winston + SEP'
      : ' · Promedio del ciclo de datos = grado anterior a la ficha (1°←Kinder 3, 2°←1°, …) · umbral ≥ 9 · Winston + SEP'
    : ''

  const statsExtra =
    conPromedio &&
    (resumen.totalWinston != null || resumen.totalSep != null || resumen.totalAmbos != null)
      ? `
        <div class="stat"><div class="val">${resumen.totalWinston ?? 0}</div><div class="lbl">Winston</div></div>
        <div class="stat"><div class="val">${resumen.totalSep ?? 0}</div><div class="lbl">SEP</div></div>
        ${
          (resumen.totalAmbos ?? 0) > 0
            ? `<div class="stat"><div class="val">${resumen.totalAmbos}</div><div class="lbl">W+SEP → SEP</div></div>`
            : ''
        }`
      : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(titulo)} · ${escapeHtml(cicloLabel)} — Servicios Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4; margin: 14mm 12mm 16mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'DM Sans', system-ui, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page { max-width: 960px; margin: 0 auto; padding: 28px 24px 40px; }
    .hero {
      background: linear-gradient(135deg, #422006 0%, #92400e 48%, #b45309 100%);
      color: #fff;
      border-radius: 20px;
      padding: 28px 30px 26px;
      margin-bottom: 22px;
      position: relative;
      overflow: hidden;
    }
    .hero::after {
      content: '';
      position: absolute;
      right: -40px; top: -40px;
      width: 180px; height: 180px;
      border-radius: 50%;
      background: rgba(255,255,255,.08);
    }
    .hero .eyebrow {
      font-size: 11px;
      letter-spacing: .14em;
      text-transform: uppercase;
      opacity: .78;
      margin-bottom: 8px;
    }
    .hero h1 {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 34px;
      font-weight: 400;
      line-height: 1.1;
      margin-bottom: 6px;
    }
    .hero .sub { font-size: 14px; opacity: .88; margin-bottom: 18px; }
    .stats { display: flex; gap: 12px; flex-wrap: wrap; }
    .stat {
      background: rgba(255,255,255,.12);
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 12px;
      padding: 10px 14px;
      min-width: 100px;
    }
    .stat .val { font-size: 22px; font-weight: 700; }
    .stat .lbl { font-size: 11px; opacity: .75; margin-top: 2px; }
    .block {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      overflow: hidden;
      margin-bottom: 16px;
      break-inside: avoid;
    }
    .block-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 18px;
      border-bottom: 1px solid #eef2f7;
      background: #fffbeb;
    }
    .block-head .eyebrow {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .12em;
      color: #92400e;
      margin-bottom: 2px;
    }
    .block-head h2 { font-size: 18px; font-weight: 700; color: #0f172a; }
    .count {
      font-size: 12px;
      font-weight: 600;
      color: #92400e;
      background: #fef3c7;
      padding: 6px 10px;
      border-radius: 999px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead th {
      text-align: left;
      font-size: 10px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: #64748b;
      padding: 10px 14px;
      background: #fffbeb;
      border-bottom: 1px solid #fde68a;
    }
    tbody td {
      padding: 9px 14px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:nth-child(even) { background: #fffdf7; }
    .num { width: 32px; color: #94a3b8; font-weight: 600; }
    .name { font-weight: 500; }
    .grp { width: 48px; text-align: center; color: #475569; }
    .pct { width: 72px; font-weight: 700; color: #b45309; text-align: center; font-size: 10px; }
    .avg { text-align: center; font-variant-numeric: tabular-nums; color: #334155; }
    .avg.strong { font-weight: 700; color: #b45309; }
    .letra { font-size: 9px; color: #94a3b8; }
    .pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 600;
      background: #eff6ff;
      color: #1d4ed8;
    }
    .pill.nivel-1 { background: #fef3c7; color: #b45309; }
    .pill.nivel-2 { background: #fce7f3; color: #be185d; }
    .pill.nivel-3 { background: #dcfce7; color: #15803d; }
    .pill.nivel-4 { background: #ede9fe; color: #6d28d9; }
    .beca-tags { display: flex; flex-wrap: wrap; gap: 4px; }
    .beca-tag {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 600;
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
    }
    .beca-tag.winston {
      background: #fff7ed;
      color: #c2410c;
      border-color: #fed7aa;
    }
    .beca-tag.sep {
      background: #eff6ff;
      color: #1d4ed8;
      border-color: #bfdbfe;
    }
    .footer {
      margin-top: 18px;
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="hero">
      <p class="eyebrow">Servicios Admin · Winston Servicios</p>
      <h1>${escapeHtml(titulo)}</h1>
      <p class="sub">${escapeHtml(cicloLabel)}${resumen.nivelFiltroLabel ? ` · ${escapeHtml(resumen.nivelFiltroLabel)}` : ''} · ${escapeHtml(fecha)}</p>
      <div class="stats">
        <div class="stat"><div class="val">${resumen.total}</div><div class="lbl">${escapeHtml(etiquetaTotal)}</div></div>
        ${statsExtra}
        <div class="stat"><div class="val">${resumen.ciclo}</div><div class="lbl">Ciclo</div></div>
      </div>
    </header>
    ${sections || '<p class="footer">Sin alumnos que cumplan el criterio en este ciclo/nivel.</p>'}
    <p class="footer">Alumnos activos con beca Winston y/o SEP en el ciclo indicado${footerExtra}</p>
  </div>
</body>
</html>`
}
