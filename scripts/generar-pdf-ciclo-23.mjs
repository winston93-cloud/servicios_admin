#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'reportes');
const HTML_PATH = path.join(OUT_DIR, 'alumnos-ciclo-23.html');
const PDF_PATH = path.join(OUT_DIR, 'alumnos-ciclo-23.pdf');

function normalizeUrl(url) {
  return url.replace(/\/+$/, '');
}

function labelNivel(n) {
  return (
    { 1: 'Maternal', 2: 'Kinder', 3: 'Primaria', 4: 'Secundaria' }[n] ??
    `Nivel ${n}`
  );
}

function labelPlantel(n) {
  return n <= 2 ? 'Instituto Educativo Winston' : 'Instituto Winston Churchill';
}

function labelGrado(nivel, grado) {
  if (nivel === 1) return grado === 1 ? 'Maternal A' : grado === 2 ? 'Maternal B' : `Maternal ${grado}`;
  if (nivel === 2) return `Kinder ${grado}`;
  if (nivel === 3) {
    const map = { 1: '1°', 2: '2°', 3: '3°', 4: '4°', 5: '5°', 6: '6°' };
    return map[grado] ?? `${grado}°`;
  }
  if (nivel === 4) {
    const map = { 1: '1°', 2: '2°', 3: '3°' };
    return map[grado] ?? `${grado}°`;
  }
  return String(grado);
}

function labelStatus(s) {
  return ({ 0: 'Inactivo', 1: 'Activo', 2: 'Baja' }[s] ?? `Estatus ${s}`);
}

async function fetchAlumnos(baseUrl, apiKey) {
  const rows = [];
  let offset = 0;
  const limit = 200;
  while (true) {
    const url =
      `${baseUrl}/api/database/records/alumno?alumno_ciclo_escolar=eq.23` +
      `&select=alumno_id,alumno_app,alumno_apm,alumno_nombre,alumno_nivel,alumno_grado,alumno_grupo,alumno_status` +
      `&order=alumno_nivel.asc,alumno_grado.asc,alumno_grupo.asc,alumno_app.asc` +
      `&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${await res.text()}`);
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    rows.push(...chunk);
    if (chunk.length < limit) break;
    offset += limit;
  }
  return rows.map((r) => ({
    id: r.alumno_id,
    nombre: [r.alumno_app, r.alumno_apm, r.alumno_nombre].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
    nivel: r.alumno_nivel,
    nivelLabel: labelNivel(r.alumno_nivel),
    plantel: labelPlantel(r.alumno_nivel),
    grado: labelGrado(r.alumno_nivel, r.alumno_grado),
    grupo: r.alumno_grupo,
    status: r.alumno_status,
    statusLabel: labelStatus(r.alumno_status),
  }));
}

function groupByNivel(alumnos) {
  const groups = new Map();
  for (const a of alumnos) {
    const key = a.nivel;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]);
}

function buildHtml(alumnos) {
  const fecha = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const activos = alumnos.filter((a) => a.status === 1).length;
  const groups = groupByNivel(alumnos);

  const sections = groups
    .map(([nivel, list]) => {
      const rows = list
        .map(
          (a, i) => `
        <tr class="${a.status === 1 ? '' : 'muted'}">
          <td class="num">${i + 1}</td>
          <td class="name">${escapeHtml(a.nombre)}</td>
          <td><span class="pill nivel-${nivel}">${escapeHtml(a.grado)}</span></td>
          <td class="grp">${a.grupo ?? '—'}</td>
          <td><span class="status s-${a.status}">${escapeHtml(a.statusLabel)}</span></td>
        </tr>`
        )
        .join('');
      const sample = list[0];
      return `
      <section class="block">
        <div class="block-head">
          <div>
            <p class="eyebrow">${escapeHtml(sample.plantel)}</p>
            <h2>${escapeHtml(sample.nivelLabel)}</h2>
          </div>
          <div class="count">${list.length} alumno${list.length === 1 ? '' : 's'}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Nombre completo</th>
              <th>Grado</th>
              <th>Grupo</th>
              <th>Estatus</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Alumnos Ciclo 23 — Winston Servicios</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
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
    .page {
      max-width: 820px;
      margin: 0 auto;
      padding: 28px 24px 40px;
    }
    .hero {
      background: linear-gradient(135deg, #0b1f3a 0%, #163a6b 52%, #1e4d8c 100%);
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
      background: rgba(255,255,255,.06);
    }
    .hero .eyebrow {
      font-size: 11px;
      letter-spacing: .14em;
      text-transform: uppercase;
      opacity: .72;
      margin-bottom: 8px;
    }
    .hero h1 {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 34px;
      font-weight: 400;
      line-height: 1.1;
      margin-bottom: 6px;
    }
    .hero .sub {
      font-size: 14px;
      opacity: .85;
      margin-bottom: 18px;
    }
    .stats {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
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
      background: #fbfdff;
    }
    .block-head .eyebrow {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .12em;
      color: #64748b;
      margin-bottom: 2px;
    }
    .block-head h2 {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
    }
    .count {
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      background: #f1f5f9;
      padding: 6px 10px;
      border-radius: 999px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    thead th {
      text-align: left;
      font-size: 10px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: #64748b;
      padding: 10px 14px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    tbody td {
      padding: 9px 14px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:nth-child(even) { background: #fcfdfe; }
    tbody tr.muted { opacity: .55; }
    .num { width: 36px; color: #94a3b8; font-weight: 600; }
    .name { font-weight: 500; }
    .grp { width: 56px; text-align: center; color: #475569; }
    .pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 10.5px;
      font-weight: 600;
      background: #eff6ff;
      color: #1d4ed8;
    }
    .pill.nivel-1 { background: #fef3c7; color: #b45309; }
    .pill.nivel-2 { background: #fce7f3; color: #be185d; }
    .pill.nivel-3 { background: #dcfce7; color: #15803d; }
    .pill.nivel-4 { background: #ede9fe; color: #6d28d9; }
    .status {
      font-size: 10px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
      display: inline-block;
    }
    .status.s-1 { background: #ecfdf5; color: #047857; }
    .status.s-0 { background: #f1f5f9; color: #64748b; }
    .status.s-2 { background: #fef2f2; color: #b91c1c; }
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
      <h1>Alumnos Ciclo Escolar 23</h1>
      <p class="sub">Listado por nivel y grado · ${escapeHtml(fecha)}</p>
      <div class="stats">
        <div class="stat"><div class="val">${alumnos.length}</div><div class="lbl">Total</div></div>
        <div class="stat"><div class="val">${activos}</div><div class="lbl">Activos</div></div>
        <div class="stat"><div class="val">${groups.length}</div><div class="lbl">Niveles</div></div>
      </div>
    </header>
    ${sections}
    <p class="footer">Generado automáticamente · Instituto Educativo Winston / Instituto Winston Churchill</p>
  </div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function main() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, '.insforge/project.json'), 'utf8'));
  if (cfg.project_name !== 'Winston Servicios') {
    throw new Error('Vincula Winston Servicios antes de generar el PDF');
  }
  const baseUrl = normalizeUrl(cfg.oss_host);
  const alumnos = await fetchAlumnos(baseUrl, cfg.api_key);
  if (!alumnos.length) throw new Error('No hay alumnos en ciclo 23');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const html = buildHtml(alumnos);
  fs.writeFileSync(HTML_PATH, html, 'utf8');

  const chromeCandidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  const chrome = chromeCandidates.find((p) => fs.existsSync(p));
  if (!chrome) throw new Error('No se encontró Chrome/Chromium para generar PDF');

  execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--print-to-pdf=${PDF_PATH}`,
      '--print-to-pdf-no-header',
      HTML_PATH,
    ],
    { stdio: 'inherit' }
  );

  console.log(`PDF: ${PDF_PATH}`);
  console.log(`HTML: ${HTML_PATH}`);
  console.log(`Alumnos: ${alumnos.length}`);
  console.log(`URL: ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://servicios-admin.vercel.app'}/reportes/alumnos-ciclo-23.pdf`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
