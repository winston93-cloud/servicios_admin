import { urlPortalPagosAlumno } from './banorteConfig'

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function htmlShellBanorte(
  titulo: string,
  paso: 1 | 2 | 'resultado',
  contenido: string,
  heroSrc?: string
): string {
  const paso1 = paso === 1 ? 'banorte-step--active' : paso === 'resultado' ? 'banorte-step--done' : ''
  const paso2 =
    paso === 2 ? 'banorte-step--active' : paso === 'resultado' ? 'banorte-step--done' : ''
  const hero = heroSrc
    ? `<div class="banorte-hero"><img src="${esc(heroSrc)}" alt="" class="banorte-hero-img" width="1200" height="320" /></div>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(titulo)} · Banorte</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/banorte-flow.css" />
</head>
<body class="banorte-body">
  <div class="banorte-bg" aria-hidden="true"></div>
  <header class="banorte-header">
    <div class="banorte-brand">
      <span class="banorte-brand-mark">W</span>
      <div>
        <p class="banorte-brand-title">Pago seguro</p>
        <p class="banorte-brand-sub">Comercio electrónico Banorte</p>
      </div>
    </div>
    <ol class="banorte-steps" aria-label="Progreso del pago">
      <li class="banorte-step ${paso1}"><span>1</span> Verificación 3D Secure</li>
      <li class="banorte-step ${paso2}"><span>2</span> Cargo a tarjeta</li>
    </ol>
  </header>
  <main class="banorte-main">
    ${hero}
    ${contenido}
  </main>
  <footer class="banorte-footer">
    <p>Transacción procesada por Banorte · Payworks</p>
  </footer>
</body>
</html>`
}

export function htmlResultadoBanorte(opts: {
  exito: boolean
  titulo: string
  mensaje: string
  referencia?: string
  detalle?: string
}): string {
  const clase = opts.exito ? 'banorte-result--ok' : 'banorte-result--error'
  const ref = opts.referencia
    ? `<p class="banorte-ref">Referencia <code>${esc(opts.referencia)}</code></p>`
    : ''
  const detalle = opts.detalle ? `<p class="banorte-result-detail">${esc(opts.detalle)}</p>` : ''
  const portal = esc(urlPortalPagosAlumno())

  const contenido = `
    <section class="banorte-card banorte-result ${clase}">
      <div class="banorte-result-icon" aria-hidden="true">${opts.exito ? '✓' : '!'}</div>
      <h1 class="banorte-result-title">${esc(opts.titulo)}</h1>
      <p class="banorte-result-msg">${esc(opts.mensaje)}</p>
      ${ref}
      ${detalle}
      ${opts.exito ? '<p class="banorte-factura-pausa">La factura electrónica se habilitará próximamente; su pago ya quedó registrado.</p>' : ''}
      <a href="${portal}" class="banorte-btn banorte-btn--primary">Volver al portal de pagos</a>
    </section>`

  return htmlShellBanorte(opts.titulo, 'resultado', contenido)
}

export function respuestaHtml(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
