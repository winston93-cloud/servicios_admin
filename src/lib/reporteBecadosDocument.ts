import type { ReporteBecadosResumen } from './reporteBecadosService'

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function etiquetaCicloLargo(ciclo: number): string {
  return `${ciclo}-${ciclo + 1}`
}

export function construirHtmlReporteBecados(
  resumen: ReporteBecadosResumen,
  opciones?: { titulo?: string; etiquetaTotal?: string }
): string {
  const titulo = opciones?.titulo ?? 'Alumnos becados'
  const etiquetaTotal = opciones?.etiquetaTotal ?? 'Becados activos'
  const fecha = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

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
          <td><span class="beca-tag">${escapeHtml(a.becaClase)}</span></td>
          <td class="pct">${a.becaPorcentaje}%</td>
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
              <th>%</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(titulo)} · Ciclo ${escapeHtml(String(resumen.ciclo))} — Servicios Admin</title>
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
    .page { max-width: 860px; margin: 0 auto; padding: 28px 24px 40px; }
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
      min-width: 110px;
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
    .pct { width: 44px; font-weight: 700; color: #b45309; text-align: center; }
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
      <p class="sub">Ciclo escolar ${escapeHtml(etiquetaCicloLargo(resumen.ciclo))} · ${escapeHtml(fecha)}</p>
      <div class="stats">
        <div class="stat"><div class="val">${resumen.total}</div><div class="lbl">${escapeHtml(etiquetaTotal)}</div></div>
        <div class="stat"><div class="val">${resumen.niveles}</div><div class="lbl">Niveles</div></div>
        <div class="stat"><div class="val">${resumen.ciclo}</div><div class="lbl">Ciclo</div></div>
      </div>
    </header>
    ${sections}
    <p class="footer">Solo alumnos activos con beca activa en el ciclo indicado · Instituto Educativo Winston / Instituto Winston Churchill</p>
  </div>
</body>
</html>`
}
