#!/usr/bin/env node
/**
 * Prueba del correo de bienvenida (fondo ampliado + confeti).
 * Uso: node scripts/enviar-prueba-bienvenida-control-escolar.mjs [email] [nivel]
 */
import nodemailer from 'nodemailer'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const to = process.argv[2] || 'sistemas.desarrollo@winston93.edu.mx'
const nivel = Number(process.argv[3] || 3)
const PORTAL = 'https://servicios-admin.vercel.app'
const CID = 'confeti-bienvenida@winston'
const gifName = nivel <= 2 ? 'confeti-educativo.gif' : 'confeti.gif'

function loadEnvLocal() {
  const p = path.join(ROOT, '.env.local')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (!(k in process.env)) process.env[k] = v
  }
}

loadEnvLocal()

function htmlBienvenida(n) {
  const institucion =
    n <= 2 ? 'INSTITUTO EDUCATIVO WINSTON' : 'INSTITUTO WINSTON CHURCHILL'
  const coord =
    n <= 2
      ? 'COORDINACIÓN KINDER'
      : n === 3
        ? 'COORDINACIÓN PRIMARIA'
        : 'COORDINACIÓN SECUNDARIA'

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fff8f0;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff8f0;">
    <tr>
      <td align="center" style="padding:12px 8px;">
        <table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #fde68a;">
          <tr>
            <td align="center" style="padding:0;background:#fffbeb;line-height:0;">
              <img src="cid:${CID}" alt="¡Felicidades!" width="680" style="display:block;width:100%;max-width:680px;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:18px 28px 8px;">
              <p style="margin:0;font-size:30px;font-weight:800;color:#0f172a;">¡Felicidades!</p>
              <p style="margin:8px 0 0;font-size:16px;font-weight:600;color:#b45309;">Ya formas parte de la comunidad Winston</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 28px 8px;font-size:15px;line-height:1.65;color:#334155;">
              <p style="margin:0 0 14px;">Por medio del presente le damos la más cordial bienvenida.</p>
              <p style="margin:0 0 18px;">Ya puede imprimir su <strong>recibo final con código QR</strong> en el portal de Servicios Administrativos:</p>
              <p style="margin:0 0 22px;text-align:center;">
                <a href="${PORTAL}" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:999px;">Abrir portal · Recibo final</a>
              </p>
              <p style="margin:0;text-align:center;font-size:13px;color:#64748b;">
                <a href="${PORTAL}" style="color:#0369a1;">${PORTAL}</a>
              </p>
              <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;text-align:center;">[PRUEBA] Fondo ampliado + confeti · nivel ${n}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 24px 28px;">
              <font size="4" style="color:#6aa84f;font-family:helvetica;">${institucion}<br>
              <font size="4" style="color:#073763;font-family:helvetica;">${coord}<br>
              <i><strong style="color:#B00;font-size:12px;">Este correo ha sido enviado de manera automática, no responder este correo porque no será leído.</strong></i></font></font>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function main() {
  const mailUser = process.env.MAIL_USER ?? 'avisos_no-replay@winston93.edu.mx'
  const mailPass = process.env.MAIL_PASS
  if (!mailPass) {
    console.error('Falta MAIL_PASS en .env.local')
    process.exit(1)
  }

  const gifPath = path.join(ROOT, 'public/control-escolar', gifName)
  if (!fs.existsSync(gifPath)) {
    console.error('Falta', gifPath)
    process.exit(1)
  }

  const nombre =
    nivel <= 2 ? 'Instituto Educativo Winston' : 'Instituto Winston Churchill'

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: mailUser, pass: mailPass },
  })

  const info = await transporter.sendMail({
    from: `"${nombre}" <${mailUser}>`,
    to,
    subject: '[PRUEBA] Bienvenida — fondo + confeti ampliado',
    html: htmlBienvenida(nivel),
    attachments: [
      {
        filename: gifName,
        content: fs.readFileSync(gifPath),
        contentType: 'image/gif',
        cid: CID,
        contentDisposition: 'inline',
      },
    ],
  })

  console.log('OK enviado a', to, 'gif=', gifName)
  console.log('messageId:', info.messageId)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
