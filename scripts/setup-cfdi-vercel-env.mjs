#!/usr/bin/env node
/** Configura URLs del módulo Facturación CFDI en Vercel (servicios-admin). */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const environments = ['production', 'preview', 'development']

const VARS = [
  ['NEXT_PUBLIC_CFDI_LEGACY_URL', 'https://www.winston93.edu.mx/cfdiwinston'],
  ['NEXT_PUBLIC_CFDI_REPORTE_XML_URL', 'https://www.winston93.edu.mx/xml'],
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

console.log('\n✓ Variables CFDI configuradas en Vercel')
