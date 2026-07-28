#!/usr/bin/env node
/**
 * Prueba del correo de bienvenida (Control Escolar) hacia un destinatario.
 * Uso: node scripts/enviar-prueba-bienvenida-control-escolar.mjs [email] [nivel]
 */
import nodemailer from 'nodemailer'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const to = process.argv[2] || 'sistemas.desarrollo@winston93.edu.mx'
const nivel = Number(process.argv[3] || 3)

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
  const archivo = n <= 2 ? 'fondoe.png' : 'fondow.png'
  const img = `https://www.winston93.edu.mx/control_escolar/${archivo}`
  const institucion =
    n <= 2 ? 'INSTITUTO EDUCATIVO WINSTON' : 'INSTITUTO WINSTON CHURCHILL'
  const coord =
    n <= 2
      ? 'COORDINACIÓN KINDER'
      : n === 3
        ? 'COORDINACIÓN PRIMARIA'
        : 'COORDINACIÓN SECUNDARIA'

  return `<div style="font-family: helvetica; font-size:14px;">Por medio del presente le damos la mas Cordial Bienvenida. Ya puede imprimir su recibo final con código QR en la dirección www.winston93.edu.mx/admisiones
<br><br>
</div>
<br><br>
<div align="center">
</div><br><br>
<p align="center"><i><font size="4" face="Times New Roman"><b></b></font></i><br>
<img src="${img}" alt=""><br><br>
<font size="4" style="color:#6aa84f; font-family: helvetica;">${institucion}<br>
<font size="4" style="color:#073763; font-family: helvetica;">${coord}<br>
<i>
<strong style="color: #B00; font-size: 12px;">Este correo ha sido enviado de manera automática, no responder este correo porque no será leído.</strong>
</font></i></p>
<p style="margin-top:24px;color:#64748b;font-size:12px;">[PRUEBA Control Escolar] Destinatario de prueba: ${to}. Nivel simulado: ${n}.</p>`
}

async function main() {
  const mailUser = process.env.MAIL_USER ?? 'avisos_no-replay@winston93.edu.mx'
  const mailPass = process.env.MAIL_PASS
  if (!mailPass) {
    console.error('Falta MAIL_PASS en .env.local')
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
    subject: '[PRUEBA] Correo de Bienvenida — Control Escolar',
    html: htmlBienvenida(nivel),
  })

  console.log('OK enviado a', to)
  console.log('messageId:', info.messageId)
  console.log('accepted:', info.accepted)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
