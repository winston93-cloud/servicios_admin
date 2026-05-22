import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER ?? 'avisos_no-replay@winston93.edu.mx',
    pass: process.env.MAIL_PASS,
  },
})

export function remitenteCorreoInstitucional(): string {
  return process.env.MAIL_USER ?? 'avisos_no-replay@winston93.edu.mx'
}

export function nombreRemitentePorNivel(nivel: number): string {
  return nivel === 1 || nivel === 2
    ? 'Instituto Educativo Winston'
    : 'Instituto Winston Churchill'
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function htmlCuerpoCorreoMasivo(mensaje: string, nombreInstitucion: string): string {
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
      <td style="background:#fff;padding:28px 24px;border-radius:0 0 16px 16px;border:1px solid #e2e8f0;border-top:none;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        ${parrafos}
        <p style="margin:24px 0 0;color:#64748b;font-size:0.9rem;line-height:1.6;">Saludos cordiales,<br><strong>${escapeHtml(nombreInstitucion)}</strong></p>
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

  try {
    const info = await transporter.sendMail({
      from: `"${nombre}" <${from}>`,
      to: destinatarios.join(', '),
      subject: opts.subject,
      html: opts.html,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    })

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
    return { ok: false, error: message }
  }
}
