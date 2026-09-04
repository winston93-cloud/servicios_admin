import { enviarCorreoMasivo, urlBaseCorreos } from '@/lib/emailServicios'
import {
  etiquetaEscalon,
  etiquetaTipoCitatorio,
  etiquetaTipoReporte,
  fraseRegistroAvisoRac,
  motivoReporte,
} from '@/lib/racCatalogo'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function htmlCorreoRac(opts: {
  titulo: string
  cuerpoHtml: string
  enlace?: string
}): string {
  const link = opts.enlace
    ? `<p style="margin:22px 0 0;text-align:center"><a href="${escapeHtml(opts.enlace)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#1e3a5f;color:#fff;text-decoration:none;font-weight:700">Ver y confirmar</a></p>
       <p style="margin:10px 0 0;color:#64748b;font-size:12px;text-align:center">${escapeHtml(opts.enlace)}</p>`
    : ''
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;padding:24px 16px">
    <tr><td style="background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:16px 16px 0 0;padding:22px 20px;text-align:center">
      <p style="margin:0;color:#fff;font-size:1.05rem;font-weight:700">Instituto Winston Churchill</p>
      <p style="margin:6px 0 0;color:#cbd5e1;font-size:.85rem">${escapeHtml(opts.titulo)}</p>
    </td></tr>
    <tr><td style="background:#fff;padding:28px 24px;border:1px solid #e2e8f0;border-top:none">
      ${opts.cuerpoHtml}
      ${link}
      <p style="margin:24px 0 0;padding:14px 16px;background:#f8fafc;border-radius:10px;color:#64748b;font-size:12px;line-height:1.55;text-align:center">
        Este correo se envió desde el buzón de avisos institucionales (el mismo de envíos masivos). No responde a este mensaje.
      </p>
    </td></tr>
  </table>
</body></html>`
}

export function urlPublicaRac(mdv: string, alt: number): string {
  return `${urlBaseCorreos()}/reportes-academicos/estatus?id=${encodeURIComponent(mdv)}&alt=${alt}`
}

/**
 * Si RAC_EMAIL_FORCE_TEST=1, todos los avisos RAC van a RAC_EMAIL_TO
 * (default sistemas.desarrollo) en lugar de papás. Útil en pruebas pre-lanzamiento.
 */
export function destinatariosRacPrueba(to: string[]): string[] {
  if (process.env.RAC_EMAIL_FORCE_TEST !== '1') return to
  const prueba =
    process.env.RAC_EMAIL_TO?.trim() || 'sistemas.desarrollo@winston93.edu.mx'
  return [prueba]
}

/** Copia oculta en todos los avisos/reportes/citas/suspensiones RAC. */
const BCC_RAC = ['prefectura.secundaria@winston93.edu.mx'] as const

export async function enviarAvisoRac(opts: {
  to: string[]
  subject: string
  html: string
}): Promise<{ ok: boolean; error?: string }> {
  return enviarCorreoMasivo({
    to: destinatariosRacPrueba(opts.to),
    subject: opts.subject,
    html: opts.html,
    nivel: 4,
    bcc: [...BCC_RAC],
  })
}

export function asuntoReporte(tipo: number, no: number): string {
  if (tipo === 5 || tipo === 8) return etiquetaTipoReporte(tipo)
  if (tipo > 2) return `${etiquetaTipoReporte(tipo)} ${no || ''}`.trim()
  if (no === 0) return `Aviso ${etiquetaTipoReporte(tipo)}`
  return `Reporte ${etiquetaTipoReporte(tipo)} ${no}`
}

export { escapeHtml, etiquetaEscalon, etiquetaTipoCitatorio, etiquetaTipoReporte, fraseRegistroAvisoRac, motivoReporte }
