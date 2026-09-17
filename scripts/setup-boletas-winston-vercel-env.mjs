#!/usr/bin/env node
/**
 * Cutover Boletas → Winston Servicios en Vercel (servicios-admin).
 * Lee BOLETAS_* desde .env.local (no imprime secrets).
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENV_FILE = path.join(ROOT, '.env.local')
const environments = ['production', 'preview', 'development']

const NAMES = ['BOLETAS_INSFORGE_URL', 'BOLETAS_INSFORGE_API_KEY']

function loadEnvLocal(filePath) {
  const out = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const i = t.indexOf('=')
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return out
}

function run(cmd, input) {
  execSync(cmd, {
    cwd: ROOT,
    input: input ?? undefined,
    stdio: input !== undefined ? ['pipe', 'pipe', 'pipe'] : ['inherit', 'pipe', 'pipe'],
    encoding: 'utf8',
  })
}

if (!fs.existsSync(ENV_FILE)) {
  console.error(`✗ Falta ${ENV_FILE}`)
  process.exit(1)
}

const envLocal = loadEnvLocal(ENV_FILE)
for (const name of NAMES) {
  if (!envLocal[name]) {
    console.error(`✗ Falta ${name} en .env.local`)
    process.exit(1)
  }
}
if (!String(envLocal.BOLETAS_INSFORGE_URL).includes('g4ta4bfg')) {
  console.error('✗ BOLETAS_INSFORGE_URL no apunta a Winston Servicios (g4ta4bfg)')
  process.exit(1)
}

if (!fs.existsSync(path.join(ROOT, '.vercel/project.json'))) {
  run('npx -y vercel link --yes --project servicios-admin')
  console.log('✓ Proyecto enlazado a servicios-admin')
}

let ok = 0
let fail = 0
for (const name of NAMES) {
  const value = envLocal[name]
  for (const env of environments) {
    try {
      run(`npx -y vercel env add ${name} ${env} --yes --force`, value)
      console.log(`✓ ${name} → ${env}`)
      ok++
    } catch (err) {
      const msg = err.stderr || err.message || String(err)
      console.error(`✗ ${name} → ${env}: ${String(msg).slice(0, 240)}`)
      fail++
    }
  }
}

console.log(`\nHecho: ${ok} ok, ${fail} fail`)
if (fail) process.exitCode = 1

try {
  run('npx -y vercel --prod --yes')
  console.log('✓ Redeploy production disparado')
} catch (err) {
  const msg = err.stderr || err.message || String(err)
  console.error(`✗ Redeploy: ${String(msg).slice(0, 300)}`)
  process.exitCode = 1
}
