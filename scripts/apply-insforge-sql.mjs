#!/usr/bin/env node
/** Aplica archivos .sql en InsForge vía `db import` (preferido) o `db query` como fallback. */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const files = process.argv.slice(2)
if (!files.length) {
  console.error('Uso: node scripts/apply-insforge-sql.mjs migrations/foo.sql ...')
  process.exit(1)
}

for (const rel of files) {
  const p = path.join(ROOT, rel)
  if (!fs.existsSync(p)) {
    console.error(`✗ No existe: ${rel}`)
    process.exitCode = 1
    continue
  }
  console.log(`▶ ${rel}`)
  try {
    execSync(`npx @insforge/cli db import ${JSON.stringify(p)}`, {
      cwd: ROOT,
      stdio: 'inherit',
    })
    console.log(`✓ ${rel}`)
  } catch (err) {
    console.error(`✗ ${rel}:`, err.message?.slice(0, 200) ?? err)
    process.exitCode = 1
  }
}
