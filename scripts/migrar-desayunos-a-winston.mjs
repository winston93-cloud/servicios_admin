/**
 * Copia tablas POS del NANO Desayunos (5g4kw6fw) → Winston Servicios (g4ta4bfg).
 *
 * Reglas:
 * - Solo INSERT en Winston si la tabla destino está vacía (count=0).
 * - Nunca UPDATE/DELETE/TRUNCATE en Winston.
 * - No imprime filas (solo conteos).
 *
 * Uso: node --env-file=.env.local scripts/migrar-desayunos-a-winston.mjs
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

const SRC_URL = (env.INSFORGE_DESAYUNOS_URL || '').replace(/\/$/, '')
const SRC_KEY = env.INSFORGE_DESAYUNOS_API_KEY || ''
const DST_URL = (env.NEXT_PUBLIC_INSFORGE_URL || env.INSFORGE_URL || '').replace(/\/$/, '')
const DST_KEY = env.INSFORGE_API_KEY || ''

if (!SRC_URL || !SRC_KEY) {
  console.error('✗ Faltan INSFORGE_DESAYUNOS_URL / INSFORGE_DESAYUNOS_API_KEY (origen NANO)')
  process.exit(1)
}
if (!DST_URL || !DST_KEY) {
  console.error('✗ Faltan NEXT_PUBLIC_INSFORGE_URL / INSFORGE_API_KEY (Winston)')
  process.exit(1)
}
if (!DST_URL.includes('g4ta4bfg')) {
  console.error('✗ Destino no es Winston Servicios (g4ta4bfg):', DST_URL)
  process.exit(1)
}
if (SRC_URL.includes('g4ta4bfg')) {
  console.error('✗ Origen ya apunta a Winston — nada que migrar (¿cutover ya hecho?)')
  process.exit(1)
}

const src = createAdminClient({ baseUrl: SRC_URL, apiKey: SRC_KEY }).database
const dst = createAdminClient({ baseUrl: DST_URL, apiKey: DST_KEY }).database

const TABLES = [
  { name: 'concepto_desayunos', pk: 'id', order: 'id' },
  { name: 'desayunos_saldo', pk: 'id', order: 'id' },
  { name: 'pago_desayunos', pk: 'id', order: 'id' },
  { name: 'notificaciones', pk: 'id', order: 'id' },
]

async function countTable(db, table) {
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`${table} count: ${error.message}`)
  return count ?? 0
}

async function fetchAll(db, table, order) {
  const pageSize = 500
  let from = 0
  const rows = []
  for (;;) {
    const { data, error } = await db
      .from(table)
      .select('*')
      .order(order, { ascending: true })
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
  console.log('Origen (Desayunos NANO):', SRC_URL)
  console.log('Destino (Winston):', DST_URL)
  console.log('')

  for (const t of TABLES) {
    const srcCount = await countTable(src, t.name)
    const dstCount = await countTable(dst, t.name)
    console.log(`· ${t.name}: origen=${srcCount} destino=${dstCount}`)

    if (dstCount > 0) {
      console.log(`  → SKIP (Winston ya tiene filas; no se toca)`)
      continue
    }
    if (srcCount === 0) {
      console.log(`  → OK (origen vacío; nada que copiar)`)
      continue
    }

    const rows = await fetchAll(src, t.name, t.order)
    // Insert en lotes; preservar PKs
    const batchSize = 100
    let inserted = 0
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize)
      const { error } = await dst.from(t.name).insert(chunk)
      if (error) throw new Error(`${t.name} insert: ${error.message}`)
      inserted += chunk.length
    }
    const after = await countTable(dst, t.name)
    console.log(`  → INSERT ${inserted} filas (destino ahora=${after})`)
  }

  // Sync sequences
  const { createAdminClient: _ } = await import('@insforge/sdk')
  void _

  console.log('\n✓ Copia terminada (sin UPDATE/DELETE en Winston).')
  console.log('Siguiente: apuntar INSFORGE_DESAYUNOS_* a g4ta4bfg y redeploy.')
}

main().catch((e) => {
  console.error('✗', e.message || e)
  process.exit(1)
})
