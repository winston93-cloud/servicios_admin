/**
 * Copia tablas Caja Chica (fvddcfy5) → Winston Servicios (g4ta4bfg).
 * Solo INSERT si destino vacío. Sin UPDATE/DELETE/TRUNCATE.
 * Uso: node --env-file=.env.local scripts/migrar-caja-chica-a-winston.mjs
 * Requiere INSFORGE_CAJA_CHICA_URL + INSFORGE_CAJA_CHICA_API_KEY (origen)
 * y NEXT_PUBLIC_INSFORGE_URL + INSFORGE_API_KEY (Winston).
 */
import { createAdminClient } from '@insforge/sdk'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvLocal() {
  const p = path.join(ROOT, '.env.local')
  const out = {}
  if (!fs.existsSync(p)) return out
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const i = t.indexOf('=')
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return out
}

const env = { ...loadEnvLocal(), ...process.env }

const SRC_URL = (env.INSFORGE_CAJA_CHICA_URL || env.CCHIC_INSFORGE_URL || '').replace(/\/$/, '')
const SRC_KEY = env.INSFORGE_CAJA_CHICA_API_KEY || env.CCHIC_INSFORGE_API_KEY || ''
const DST_URL = (env.NEXT_PUBLIC_INSFORGE_URL || env.INSFORGE_URL || '').replace(/\/$/, '')
const DST_KEY = env.INSFORGE_API_KEY || ''

if (!SRC_URL || !SRC_KEY) {
  console.error('✗ Faltan INSFORGE_CAJA_CHICA_URL / INSFORGE_CAJA_CHICA_API_KEY')
  process.exit(1)
}
if (!DST_URL?.includes('g4ta4bfg') || !DST_KEY) {
  console.error('✗ Destino debe ser Winston (g4ta4bfg)')
  process.exit(1)
}
if (SRC_URL.includes('g4ta4bfg')) {
  console.error('✗ Origen ya es Winston')
  process.exit(1)
}

const src = createAdminClient({ baseUrl: SRC_URL, apiKey: SRC_KEY }).database
const dst = createAdminClient({ baseUrl: DST_URL, apiKey: DST_KEY }).database

// Orden por FKs
const TABLES = [
  'categories',
  'persons',
  'executors',
  'subcategories',
  'funds',
  'expenses',
  'person_categories',
  'custom_periods',
]

async function countTable(db, table) {
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`${table} count: ${error.message}`)
  return count ?? 0
}

async function fetchAll(db, table) {
  const pageSize = 500
  let from = 0
  const rows = []
  for (;;) {
    const { data, error } = await db
      .from(table)
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`${table} fetch: ${error.message}`)
    const batch = data || []
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return rows
}

async function main() {
  console.log('Origen (Caja Chica):', SRC_URL)
  console.log('Destino (Winston):', DST_URL)
  for (const name of TABLES) {
    const srcCount = await countTable(src, name)
    const dstCount = await countTable(dst, name)
    console.log(`· ${name}: origen=${srcCount} destino=${dstCount}`)
    if (dstCount > 0) {
      console.log('  → SKIP (Winston ya tiene filas)')
      continue
    }
    if (srcCount === 0) {
      console.log('  → OK (origen vacío)')
      continue
    }
    const rows = await fetchAll(src, name)
    const batchSize = 100
    let inserted = 0
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize)
      const { error } = await dst.from(name).insert(chunk)
      if (error) throw new Error(`${name} insert: ${error.message}`)
      inserted += chunk.length
    }
    console.log(`  → INSERT ${inserted} (destino=${await countTable(dst, name)})`)
  }
  console.log('\n✓ Copia terminada')
}

main().catch((e) => {
  console.error('✗', e.message || e)
  process.exit(1)
})
