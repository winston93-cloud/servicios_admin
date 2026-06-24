#!/usr/bin/env node
/** Configura NEXT_PUBLIC_CCHIC_URL en Vercel (servicios-admin). */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VALUE = 'https://cchic.vercel.app'
const NAME = 'NEXT_PUBLIC_CCHIC_URL'
const environments = ['production', 'preview', 'development']

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

for (const env of environments) {
  try {
    run(`npx vercel env add ${NAME} ${env} --yes --force`, VALUE)
    console.log(`✓ ${NAME} → ${env}`)
  } catch (err) {
    const msg = err.stderr || err.message || String(err)
    console.error(`✗ ${NAME} → ${env}: ${msg.slice(0, 200)}`)
    process.exitCode = 1
  }
}

console.log(`\n✓ ${NAME} configurada en Vercel`)
