#!/usr/bin/env node
/**
 * Variables FacturoPorTi en Vercel (servicios-admin).
 * Solo URLs y nombres de bearer; CSD/KEY/PASSWORD se agregan en el dashboard como secrets.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const environments = ['production', 'preview', 'development']

const VARS = [
  ['FACTUROPORTI_API_URL', 'https://api.facturoporti.com.mx'],
  ['FACTUROPORTI_BEARER_CHURCHILL', ''],
  ['FACTUROPORTI_BEARER_EDUCATIVO', ''],
]

const SECRET_NAMES = [
  'FACTUROPORTI_CHURCHILL_CSD',
  'FACTUROPORTI_CHURCHILL_KEY',
  'FACTUROPORTI_CHURCHILL_CSD_PASSWORD',
  'FACTUROPORTI_CHURCHILL_LOGO_BASE64',
  'FACTUROPORTI_EDUCATIVO_CSD',
  'FACTUROPORTI_EDUCATIVO_KEY',
  'FACTUROPORTI_EDUCATIVO_CSD_PASSWORD',
  'FACTUROPORTI_EDUCATIVO_LOGO_BASE64',
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
      console.error(`✗ ${name} → ${env}: ${msg.slice(0, 200)}`)
      process.exitCode = 1
    }
  }
}

console.log('\nAgrega manualmente en Vercel (Sensitive) los CSD/KEY/PASSWORD:')
for (const name of SECRET_NAMES) {
  console.log(`  - ${name}`)
}
console.log('\n✓ Variables FacturoPorTi base configuradas en Vercel')
