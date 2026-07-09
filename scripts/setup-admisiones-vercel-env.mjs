#!/usr/bin/env node
/** Variables del portal de inscripciones en Vercel (servicios-admin). */
import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const environments = ['production', 'preview', 'development']

const jwtSecret =
  process.env.JWT_DOCUMENTOS_SECRET?.trim() ||
  crypto.randomBytes(32).toString('hex')

const VARS = [
  ['NEXT_PUBLIC_ADMISIONES_LEGACY_URL', 'https://winston93.edu.mx/admisiones'],
  ['NEXT_PUBLIC_PORTAL_DOCUMENTOS_URL', 'https://documentos.winston93.edu.mx/documentos'],
  ['JWT_DOCUMENTOS_SECRET', jwtSecret],
  ['JWT_DOCUMENTOS_ISSUER', 'winston-escolar'],
  ['JWT_DOCUMENTOS_TTL_SEC', '3600'],
  ['ADMISIONES_CAMBIO_CICLO', '07-10'],
]

function run(cmd, input) {
  execSync(cmd, {
    cwd: ROOT,
    input: input ?? undefined,
    stdio: input !== undefined ? ['pipe', 'pipe', 'pipe'] : ['inherit', 'pipe', 'pipe'],
    encoding: 'utf8',
  })
}

if (!fs.existsSync(path.join(ROOT, '.vercel/project.json'))) {
  run('npx vercel link --yes --project servicios-admin')
  console.log('✓ Proyecto enlazado a servicios-admin')
}

for (const [name, value] of VARS) {
  for (const env of environments) {
    try {
      run(`npx vercel env add ${name} ${env} --yes --force`, value)
      console.log(`✓ ${name} → ${env}`)
    } catch (err) {
      const msg = err.stderr || err.message || String(err)
      console.error(`✗ ${name} → ${env}: ${msg.slice(0, 240)}`)
      process.exitCode = 1
    }
  }
}

console.log('\n✓ Variables de admisiones configuradas en Vercel')
if (!process.env.JWT_DOCUMENTOS_SECRET) {
  console.log(
    '\n⚠ JWT_DOCUMENTOS_SECRET generado para Vercel. Debe coincidir en admisiones/module/jwt.php:\n',
    jwtSecret
  )
}
