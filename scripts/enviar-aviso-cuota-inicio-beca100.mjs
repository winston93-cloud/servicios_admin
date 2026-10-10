#!/usr/bin/env node
/**
 * Aviso a mamás de becados al 100% que aún no pagan la Cuota de Inicio de Curso.
 *
 * Uso:
 *   node scripts/enviar-aviso-cuota-inicio-beca100.mjs <lista.json> --prueba [email]
 *   node scripts/enviar-aviso-cuota-inicio-beca100.mjs <lista.json> --enviar
 *
 * lista.json: { "ciclo": "2026-2027", "destinatarios": [
 *   { "control", "alumno", "grado", "nivel", "emails": [], "monto" } ] }
 * `emails`: familiares con «recibir correos» activo (mamá, papá o ambos).
 * `--prueba` manda solo el primer destinatario al correo indicado.
 */
import nodemailer from 'nodemailer'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = 'https://servicios.winston93.edu.mx'
const PORTAL = `${BASE}/portal-pagos`
const COPIA_SISTEMAS = 'sistemas.desarrollo@winston93.edu.mx'

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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!(k in process.env)) process.env[k] = v
  }
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const pesos = (n) =>
  Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })

function branding(nivel) {
  const educativo = nivel === 1 || nivel === 2
  return {
    institucion: educativo ? 'Instituto Educativo Winston' : 'Instituto Winston Churchill',
    logo: `${BASE}/logos/${educativo ? 'logo-winston-educativo.png' : 'logo-winston-churchill.png'}`,
  }
}

function htmlAviso(d, ciclo) {
  const { institucion, logo } = branding(Number(d.nivel))
  const p = (t) => `<p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.65;">${t}</p>`
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <tr>
      <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);background-color:#1e3a5f;border-radius:16px 16px 0 0;padding:22px 20px;text-align:center;">
        <p style="margin:0;color:#fff;font-size:17px;font-weight:700;">Cuota de Inicio de Curso ${esc(ciclo)}</p>
      </td>
    </tr>
    <tr>
      <td style="background:#fff;padding:28px 24px;border:1px solid #e2e8f0;border-top:none;">
        ${p('Estimados padres de familia:')}
        ${p(`Le informamos que ya puede realizar el pago de la <strong>Cuota de Inicio de Curso</strong> del ciclo escolar ${esc(ciclo)} de su hijo(a) <strong>${esc(d.alumno)}</strong> (${esc(d.grado)}, control ${esc(d.control)}).`)}
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:6px 0 20px;">
          <tr>
            <td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;text-align:center;">
              <p style="margin:0;color:#1e3a5f;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">Importe a pagar</p>
              <p style="margin:6px 0 0;color:#0f172a;font-size:28px;font-weight:800;">${esc(pesos(d.monto))}</p>
              <p style="margin:6px 0 0;color:#047857;font-size:13px;font-weight:600;">Sin recargo</p>
            </td>
          </tr>
        </table>
        ${p('Puede pagarla de cualquiera de estas formas:')}
        <ul style="margin:0 0 18px;padding-left:20px;color:#334155;font-size:15px;line-height:1.65;">
          <li><strong>En línea</strong>, de dos formas:
            <ul style="margin:4px 0 0;padding-left:18px;">
              <li>Pago con tarjeta de crédito o débito.</li>
              <li>Pago SPEI, desde la app de su banco.</li>
            </ul>
          </li>
          <li><strong>En efectivo en ventanilla Banorte</strong>, imprimiendo su boucher desde el portal de pagos.</li>
        </ul>
        <p style="margin:0 0 22px;text-align:center;">
          <a href="${PORTAL}" style="display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:999px;">Ir al portal de pagos</a>
        </p>
        <p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6;">Saludos cordiales,</p>
        <p style="margin:0 0 6px;text-align:center;"><img src="${esc(logo)}" alt="${esc(institucion)}" width="120" style="display:inline-block;max-width:120px;height:auto;" /></p>
        <p style="margin:0 0 20px;text-align:center;color:#1e293b;font-size:15px;font-weight:700;">${esc(institucion)}</p>
        <p style="margin:0;padding:14px 16px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.55;text-align:center;">Este correo fue enviado desde una cuenta que no acepta respuestas. Por favor no responda a este mensaje; si requiere apoyo, comuníquese con la institución por los canales oficiales.</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function main() {
  loadEnvLocal()
  const [archivo, modo, emailPrueba] = process.argv.slice(2)
  if (!archivo || !['--prueba', '--enviar'].includes(modo)) {
    console.error('Uso: <lista.json> --prueba [email] | --enviar')
    process.exit(1)
  }
  const mailUser = process.env.MAIL_USER ?? 'avisos_no-replay@winston93.edu.mx'
  if (!process.env.MAIL_PASS) {
    console.error('Falta MAIL_PASS en .env.local')
    process.exit(1)
  }
  const { ciclo, destinatarios } = JSON.parse(fs.readFileSync(archivo, 'utf8'))
  const lista = modo === '--prueba' ? destinatarios.slice(0, 1) : destinatarios

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    pool: true,
    maxConnections: 1,
    rateDelta: 2000,
    rateLimit: 1,
    auth: { user: mailUser, pass: process.env.MAIL_PASS },
  })

  for (const d of lista) {
    const emails = [...new Set((d.emails ?? []).map((e) => String(e).trim().toLowerCase()))].filter((e) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
    )
    if (modo === '--enviar' && !emails.length) {
      console.error('SIN CORREO', d.control)
      continue
    }
    const to = modo === '--prueba' ? emailPrueba || COPIA_SISTEMAS : emails.join(', ')
    const asunto = `Cuota de Inicio de Curso ${ciclo} — ${d.alumno}`
    try {
      const info = await transporter.sendMail({
        from: `"${branding(Number(d.nivel)).institucion}" <${mailUser}>`,
        to,
        ...(modo === '--enviar' && to !== COPIA_SISTEMAS ? { bcc: COPIA_SISTEMAS } : {}),
        subject: modo === '--prueba' ? `[PRUEBA] ${asunto}` : asunto,
        html: htmlAviso(d, ciclo),
      })
      console.log('OK', d.control, '→', to, info.messageId)
    } catch (e) {
      console.error('ERROR', d.control, '→', to, e instanceof Error ? e.message : e)
    }
  }
  transporter.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
