#!/usr/bin/env node
/**
 * Sincroniza credenciales FacturoPorTi desde cfdiwinston/timbrar.php → Vercel (servicios-admin).
 * No escribe secrets en el repo; lee el PHP legacy en tiempo de ejecución.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LEGACY_PHP = path.resolve(ROOT, '../cfdiwinston/timbrar.php')
const environments = ['production', 'preview', 'development']

function run(cmd, input) {
  execSync(cmd, {
    cwd: ROOT,
    input: input ?? undefined,
    stdio: input !== undefined ? ['pipe', 'pipe', 'pipe'] : ['inherit', 'pipe', 'pipe'],
    encoding: 'utf8',
  })
}

function extractAll(pattern, text) {
  const re = new RegExp(pattern, 'g')
  const out = []
  let m
  while ((m = re.exec(text)) !== null) out.push(m[1])
  return out
}

function parseLegacyTimbrar(php) {
  const csds = extractAll('"CSD": "([^"]+)"', php)
  const keys = extractAll('"LlavePrivada": "([^"]+)"', php)
  const passwords = extractAll('"CSDPassword": "([^"]+)"', php)
  const bearerMatch = php.match(/Bearer ([A-Za-z0-9._-]+)/)
  const bearer = bearerMatch?.[1] ?? ''

  if (csds.length < 2 || keys.length < 2 || passwords.length < 2) {
    throw new Error('No se pudieron extraer CSD/KEY/PASSWORD de timbrar.php')
  }
  if (!bearer) throw new Error('No se encontró Bearer en timbrar.php')

  return {
    educativo: { csd: csds[0], key: keys[0], password: passwords[0] },
    churchill: { csd: csds[1], key: keys[1], password: passwords[1] },
    bearer,
  }
}

function logoBase64IfExists(filename) {
  const candidates = [
    path.resolve(ROOT, 'assets/cfdi', filename),
    path.resolve(ROOT, '../cfdiwinston', filename),
    path.resolve(ROOT, '../banorte', filename),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p).toString('base64')
  }
  return ''
}

if (!fs.existsSync(LEGACY_PHP)) {
  console.error(`✗ No existe ${LEGACY_PHP}`)
  process.exit(1)
}

const legacy = parseLegacyTimbrar(fs.readFileSync(LEGACY_PHP, 'utf8'))

const VARS = [
  ['FACTUROPORTI_API_URL', 'https://api.facturoporti.com.mx'],
  ['FACTUROPORTI_BEARER_CHURCHILL', legacy.bearer],
  ['FACTUROPORTI_BEARER_EDUCATIVO', legacy.bearer],
  ['FACTUROPORTI_CHURCHILL_CSD', legacy.churchill.csd],
  ['FACTUROPORTI_CHURCHILL_KEY', legacy.churchill.key],
  ['FACTUROPORTI_CHURCHILL_CSD_PASSWORD', legacy.churchill.password],
  ['FACTUROPORTI_CHURCHILL_LOGO_BASE64', logoBase64IfExists('escudo.png')],
  ['FACTUROPORTI_EDUCATIVO_CSD', legacy.educativo.csd],
  ['FACTUROPORTI_EDUCATIVO_KEY', legacy.educativo.key],
  ['FACTUROPORTI_EDUCATIVO_CSD_PASSWORD', legacy.educativo.password],
  ['FACTUROPORTI_EDUCATIVO_LOGO_BASE64', logoBase64IfExists('educativo.png')],
]

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
      console.error(`✗ ${name} → ${env}: ${msg.slice(0, 200)}`)
      process.exitCode = 1
    }
  }
}

console.log('\n✓ Credenciales FacturoPorTi sincronizadas en Vercel (sin commitear al repo)')
