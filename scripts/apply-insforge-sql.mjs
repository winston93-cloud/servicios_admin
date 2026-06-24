#!/usr/bin/env node
/** Aplica archivos .sql en InsForge (quita comentarios -- para evitar conflicto con el CLI). */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function stripLineComments(sql) {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .trim()
}

const files = process.argv.slice(2)
if (!files.length) {
  console.error('Uso: node scripts/apply-insforge-sql.mjs migrations/foo.sql ...')
  process.exit(1)
}

for (const rel of files) {
  const p = path.join(ROOT, rel)
  const sql = stripLineComments(fs.readFileSync(p, 'utf8'))
  if (!sql) continue
  console.log(`▶ ${rel}`)
  const out = execSync(`npx @insforge/cli db query ${JSON.stringify(sql)} --json`, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const preview = out.trim().slice(0, 300)
  if (preview) console.log(preview)
  console.log(`✓ ${rel}`)
}
