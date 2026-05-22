import nodemailer from 'nodemailer'

/** Copia oculta en todos los envíos de correo masivo. */
const COPIA_CORREO_SISTEMAS = 'sistemas.desarrollo@winston93.edu.mx'

const AVISO_NO_RESPONDER =
  'Este correo fue enviado desde una cuenta que no acepta respuestas. Por favor no responda a este mensaje; si requiere apoyo, comuníquese con la institución por los canales oficiales.'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function esErrorLimiteGmail(mensaje: string): boolean {
  return /454|too many login|rate limit|421|4\.7\.0/i.test(mensaje)
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  pool: true,
  maxConnections: 1,
  maxMessages: 80,
  rateDelta: 2000,
  rateLimit: 1,
  auth: {
    user: process.env.MAIL_USER ?? 'avisos_no-replay@winston93.edu.mx',
    pass: process.env.MAIL_PASS,
  },
})

export function remitenteCorreoInstitucional(): string {
  return process.env.MAIL_USER ?? 'avisos_no-replay@winston93.edu.mx'
}

export function urlBaseCorreos(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '')}`
  return 'https://winston93.edu.mx'
}

export function brandingCorreoPorNivel(nivel: number) {
  const educativo = nivel === 1 || nivel === 2
  const base = urlBaseCorreos()
  return {
    nombreInstitucion: educativo
      ? 'Instituto Educativo Winston'
      : 'Instituto Winston Churchill',
    logoUrl: educativo
      ? `${base}/logos/logo-winston-educativo.png`
      : `${base}/logos/logo-winston-churchill.png`,
    logoAlt: educativo ? 'Instituto Educativo Winston' : 'Instituto Winston Churchill',
  }
}

export function nombreRemitentePorNivel(nivel: number): string {
  return brandingCorreoPorNivel(nivel).nombreInstitucion
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function htmlCuerpoCorreoMasivo(mensaje: string, nivel: number): string {
  const { nombreInstitucion, logoUrl, logoAlt } = brandingCorreoPorNivel(nivel)

  const parrafos = escapeHtml(mensaje)
    .split(/\n/)
    .map((linea) =>
      linea.trim()
        ? `<p style="margin: 0 0 14px; color: #334155; font-size: 1rem; line-height: 1.65;">${linea}</p>`
        : '<p style="margin: 0 0 10px;">&nbsp;</p>'
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <tr>
      <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px 16px 0 0;padding:22px 20px;text-align:center;">
        <p style="margin:0;color:#fff;font-size:1.05rem;font-weight:700;">Comunicado institucional</p>
      </td>
    </tr>
    <tr>
      <td style="background:#fff;padding:28px 24px;border:1px solid #e2e8f0;border-top:none;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        ${parrafos}
        <p style="margin:24px 0 20px;color:#64748b;font-size:0.9rem;line-height:1.6;">Saludos cordiales,</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
          <tr>
            <td style="text-align:center;padding:8px 0 12px;">
              <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(logoAlt)}" width="120" height="auto" style="display:inline-block;max-width:120px;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="text-align:center;">
              <p style="margin:0;color:#1e293b;font-size:1rem;font-weight:700;">${escapeHtml(nombreInstitucion)}</p>
            </td>
          </tr>
        </table>
        <p style="margin:0;padding:14px 16px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;color:#64748b;font-size:0.8rem;line-height:1.55;text-align:center;">${escapeHtml(AVISO_NO_RESPONDER)}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 8px 0;text-align:center;">
        <p style="margin:0;color:#94a3b8;font-size:0.75rem;">${escapeHtml(nombreInstitucion)}</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export interface AdjuntoCorreo {
  filename: string
  content: Buffer
  contentType?: string
}

export interface ResultadoEnvioCorreo {
  ok: boolean
  messageId?: string
  accepted?: string[]
  rejected?: string[]
  error?: string
}

export async function enviarCorreoMasivo(opts: {
  to: string[]
  subject: string
  html: string
  nivel: number
  attachments?: AdjuntoCorreo[]
}): Promise<ResultadoEnvioCorreo> {
  const destinatarios = [...new Set(opts.to.map((e) => e.trim().toLowerCase()).filter(Boolean))]
  if (!destinatarios.length) {
    return { ok: false, error: 'Sin destinatarios válidos' }
  }

  if (!process.env.MAIL_PASS) {
    return { ok: false, error: 'Falta configurar MAIL_PASS en el servidor (.env.local)' }
  }

  const from = remitenteCorreoInstitucional()
  const nombre = nombreRemitentePorNivel(opts.nivel)
  const mailOptions = {
    from: `"${nombre}" <${from}>`,
    to: destinatarios.join(', '),
    bcc: COPIA_CORREO_SISTEMAS,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  }

  const maxIntentos = 4

  for (let intento = 0; intento < maxIntentos; intento++) {
    try {
      const info = await transporter.sendMail(mailOptions)
      const accepted = (info.accepted ?? []).map(String)
      const rejected = (info.rejected ?? []).map(String)

      return {
        ok: rejected.length === 0 && accepted.length > 0,
        messageId: info.messageId,
        accepted,
        rejected,
        error: rejected.length ? `Rechazados: ${rejected.join(', ')}` : undefined,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al enviar correo'
      if (esErrorLimiteGmail(message) && intento < maxIntentos - 1) {
        await sleep(18_000 * (intento + 1))
        continue
      }
      return {
        ok: false,
        error: esErrorLimiteGmail(message)
          ? 'Gmail bloqueó envíos por exceso de intentos. Espere 2–5 minutos y use «Reenviar solo errores».'
          : message,
      }
    }
  }

  return { ok: false, error: 'No se pudo enviar tras varios intentos' }
}
