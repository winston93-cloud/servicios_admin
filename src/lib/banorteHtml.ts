import { urlPortalPagosAlumno } from './banorteConfig'
import {
  etiquetaCategoria3d,
  type DetalleError3dSecure,
} from './banorte3dsErrors'

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
    <p>Comercio electrónico Banorte · Payworks · tarjetas de cualquier banco</p>
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
  facturaPdf?: string | null
  facturaXml?: string | null
  facturaPendiente?: string | null
  facturaDetalleTecnico?: string | null
}): string {
  const clase = opts.exito ? 'banorte-result--ok' : 'banorte-result--error'
  const ref = opts.referencia
    ? `<p class="banorte-ref">Referencia <code>${esc(opts.referencia)}</code></p>`
    : ''
  const detalle = opts.detalle ? `<p class="banorte-result-detail">${esc(opts.detalle)}</p>` : ''
  const portal = esc(urlPortalPagosAlumno())

  let facturaBlock = ''
  if (opts.exito) {
    if (opts.facturaPdf || opts.facturaXml) {
      const links = [
        opts.facturaPdf
          ? `<a class="banorte-btn banorte-btn--ghost" href="${esc(opts.facturaPdf)}" target="_blank" rel="noopener">Descargar PDF</a>`
          : '',
        opts.facturaXml
          ? `<a class="banorte-btn banorte-btn--ghost" href="${esc(opts.facturaXml)}" target="_blank" rel="noopener">Descargar XML</a>`
          : '',
      ]
        .filter(Boolean)
        .join('')
      facturaBlock = `<aside class="banorte-factura-box banorte-factura-box--ok" aria-label="Factura electrónica">
        <p class="banorte-factura-box-label">Factura electrónica</p>
        <p class="banorte-factura-box-title">Emitida correctamente</p>
        <p class="banorte-factura-box-text">Ya puede descargar su CFDI.</p>
        <div class="banorte-result-actions">${links}</div>
      </aside>`
    } else if (opts.facturaPendiente) {
      const tecnico = opts.facturaDetalleTecnico
        ? `<p class="banorte-factura-box-tecnico"><span>Detalle técnico:</span> ${esc(opts.facturaDetalleTecnico)}</p>`
        : ''
      facturaBlock = `<aside class="banorte-factura-box banorte-factura-box--pendiente" aria-label="Factura pendiente">
        <p class="banorte-factura-box-label">Factura electrónica</p>
        <p class="banorte-factura-box-title">Pendiente</p>
        <p class="banorte-factura-box-text">${esc(opts.facturaPendiente)}</p>
        ${tecnico}
      </aside>`
    }
  }

  const contenido = `
    <section class="banorte-card banorte-result ${clase}">
      <div class="banorte-result-icon" aria-hidden="true">${opts.exito ? '✓' : '!'}</div>
      <h1 class="banorte-result-title">${esc(opts.titulo)}</h1>
      <p class="banorte-result-msg">${esc(opts.mensaje)}</p>
      ${ref}
      ${detalle}
      ${facturaBlock}
      <a href="${portal}" class="banorte-btn banorte-btn--primary">Volver al portal de pagos</a>
    </section>`

  return htmlShellBanorte(opts.titulo, 'resultado', contenido)
}

/** Pantalla profesional cuando 3D Secure devuelve Estatus distinto de 200. */
export function htmlResultado3dSecureRechazo(
  detalle: DetalleError3dSecure,
  referencia: string
): string {
  const ref =
    referencia && referencia !== '—'
      ? `<p class="banorte-ref">Referencia de pago <code>${esc(referencia)}</code></p>`
      : ''

  const codigoBadge =
    detalle.codigo != null
      ? `<p class="banorte-result-code" aria-label="Código de error Banorte">Código Banorte <strong>${detalle.codigo}</strong> · ${esc(etiquetaCategoria3d(detalle.categoria))}</p>`
      : ''

  const tecnico = detalle.detalleTecnico
    ? `<p class="banorte-result-tecnico"><span>Detalle del procesador:</span> ${esc(detalle.detalleTecnico)}</p>`
    : ''

  const portal = esc(urlPortalPagosAlumno())

  const contenido = `
    <section class="banorte-card banorte-result banorte-result--error banorte-result--3ds">
      <div class="banorte-result-icon" aria-hidden="true">✕</div>
      <p class="banorte-result-eyebrow">Paso 1 de 2 · 3D Secure</p>
      <h1 class="banorte-result-title">${esc(detalle.titulo)}</h1>
      <p class="banorte-result-msg">${esc(detalle.mensaje)}</p>
      ${codigoBadge}
      <div class="banorte-result-hint">
        <p class="banorte-result-hint-title">Qué puede hacer</p>
        <p>${esc(detalle.sugerencia)}</p>
      </div>
      ${tecnico}
      ${ref}
      <p class="banorte-result-note">No se realizó ningún cargo. Puede cerrar esta ventana e intentar de nuevo desde el portal de pagos.</p>
      <div class="banorte-result-actions">
        <a href="${portal}" class="banorte-btn banorte-btn--primary">Volver al portal de pagos</a>
        <button type="button" class="banorte-btn banorte-btn--ghost" onclick="window.close()">Cerrar ventana</button>
      </div>
    </section>`

  return htmlShellBanorte('Verificación 3D Secure', 'resultado', contenido)
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
