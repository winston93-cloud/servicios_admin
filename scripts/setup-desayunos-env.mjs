#!/usr/bin/env node
/**
 * Apunta INSFORGE_DESAYUNOS_* de servicios_admin a Winston Servicios (g4ta4bfg).
 * Tras el cutover Desayunos NANO → Winston.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const winstonCfg = JSON.parse(fs.readFileSync(path.join(root, '.insforge/project.json'), 'utf8'))

if (!String(winstonCfg.appkey || winstonCfg.oss_host || '').includes('g4ta4bfg') &&
    !String(winstonCfg.oss_host || '').includes('g4ta4bfg')) {
  console.error('✗ .insforge/project.json no es Winston Servicios (g4ta4bfg)')
  process.exit(1)
}

const envPath = path.join(root, '.env.local')
let text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''

function upsert(key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm')
  const line = `${key}=${value}`
  if (re.test(text)) text = text.replace(re, line)
  else text += (text.endsWith('\n') || text === '' ? '' : '\n') + line + '\n'
}

upsert('INSFORGE_DESAYUNOS_URL', winstonCfg.oss_host)
upsert('INSFORGE_DESAYUNOS_API_KEY', winstonCfg.api_key)
fs.writeFileSync(envPath, text)
console.log('✓ servicios_admin .env.local — INSFORGE_DESAYUNOS_* → Winston Servicios')
