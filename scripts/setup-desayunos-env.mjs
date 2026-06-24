#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serviciosRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const desayunosCfg = JSON.parse(
  fs.readFileSync(path.join(serviciosRoot, '../services/.insforge/project.json'), 'utf8')
)
const envPath = path.join(serviciosRoot, '.env.local')
let text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
const lines = [
  '',
  '# Proyecto Desayunos (POS, notificaciones portal familias)',
  `INSFORGE_DESAYUNOS_URL=${desayunosCfg.oss_host}`,
  `INSFORGE_DESAYUNOS_API_KEY=${desayunosCfg.api_key}`,
]
for (const line of lines) {
  const key = line.split('=')[0]
  if (key && !key.startsWith('#') && text.includes(`${key}=`)) continue
  if (line.startsWith('#') || line === '') {
    if (!text.includes(line.trim()) && line !== '') text += line + '\n'
    else if (line === '') text += '\n'
    continue
  }
  text += line + '\n'
}
fs.writeFileSync(envPath, text)
console.log('✓ servicios_admin .env.local — vars Desayunos listas')
