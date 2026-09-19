/**
 * Copia tablas Cheques (3p3q5w7a) → Winston Servicios (g4ta4bfg).
 * Solo INSERT si destino vacío. Sin UPDATE/DELETE/TRUNCATE.
 *
 * Uso:
 *   node --env-file=.env.local scripts/migrar-cheques-a-winston.mjs
 *
 * Origen: INSFORGE_CHEQUES_URL + INSFORGE_CHEQUES_API_KEY
 *   (o se leen de link temporal / cheques_new .env.local)
 * Destino: NEXT_PUBLIC_INSFORGE_URL + INSFORGE_API_KEY (Winston g4ta4bfg)
 */
import { createAdminClient } from '@insforge/sdk'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CHEQUES_PROJECT_ID = '9c8e157a-e817-4116-ab20-e9680a43159e'
const WINSTON_PROJECT_ID = '1a769c0a-ab1b-4500-bb6b-1e8bb131980b'

function loadEnvFile(filePath) {
  const out = {}
  if (!fs.existsSync(filePath)) return out
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const i = t.indexOf('=')
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return out
}

function readLinkedProject() {
  const p = path.join(ROOT, '.insforge', 'project.json')
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function linkProject(projectId) {
  execSync(`npx -y @insforge/cli link --project-id ${projectId} -y --json`, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return readLinkedProject()
}

const env = {
  ...loadEnvFile(path.join(ROOT, '.env.local')),
  ...loadEnvFile(path.join('/home/mario/Proyectos/cheques_new', '.env.local')),
  ...process.env,
}

let SRC_URL = (env.INSFORGE_CHEQUES_URL || '').replace(/\/$/, '')
let SRC_KEY = env.INSFORGE_CHEQUES_API_KEY || ''
let DST_URL = (env.NEXT_PUBLIC_INSFORGE_URL || env.INSFORGE_URL || '').replace(/\/$/, '')
let DST_KEY = env.INSFORGE_API_KEY || ''

if (!SRC_URL || !SRC_KEY) {
  console.log('Obteniendo credenciales origen (Cheques NANO) vía CLI…')
  const cfg = linkProject(CHEQUES_PROJECT_ID)
  SRC_URL = String(cfg?.oss_host || '').replace(/\/$/, '')
  SRC_KEY = cfg?.api_key || ''
}

if (!DST_URL?.includes('g4ta4bfg') || !DST_KEY) {
  console.log('Obteniendo credenciales destino (Winston) vía CLI…')
  const cfg = linkProject(WINSTON_PROJECT_ID)
  DST_URL = String(cfg?.oss_host || '').replace(/\/$/, '')
  DST_KEY = cfg?.api_key || ''
} else {
  // Asegurar CLI en Winston al terminar
  linkProject(WINSTON_PROJECT_ID)
}

if (!SRC_URL?.includes('3p3q5w7a') || !SRC_KEY) {
  console.error('✗ Origen debe ser NANO Cheques (3p3q5w7a)')
  process.exit(1)
}
if (!DST_URL?.includes('g4ta4bfg') || !DST_KEY) {
  console.error('✗ Destino debe ser Winston (g4ta4bfg)')
  process.exit(1)
}

const src = createAdminClient({ baseUrl: SRC_URL, apiKey: SRC_KEY }).database
const dst = createAdminClient({ baseUrl: DST_URL, apiKey: DST_KEY }).database

/** Orden: catálogos primero (FK subconceptos → conceptos), luego cheques. */
const TABLES = [
  { name: 'ch_nombres', order: 'id' },
  { name: 'ch_conceptos', order: 'id' },
  { name: 'ch_subconceptos', order: 'id' },
  { name: 'cheques_banco', order: 'id' },
  { name: 'ch_cheques', order: 'idcheque' },
  { name: 'ch_cheques_ed', order: 'idcheque' },
  { name: 'ch_cheques_sw', order: 'idcheque' },
  { name: 'ch_cheques_se', order: 'idcheque' },
]

async function countTable(db, table) {
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`${table} count: ${error.message}`)
  return count ?? 0
}

async function fetchAll(db, table, orderCol) {
  const pageSize = 500
  let from = 0
  const rows = []
  for (;;) {
    const { data, error } = await db
      .from(table)
      .select('*')
      .order(orderCol, { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`${table} fetch: ${error.message}`)
    const batch = data || []
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return rows
}

async function insertChunks(db, table, rows) {
  const chunkSize = 200
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await db.from(table).insert(chunk)
    if (error) throw new Error(`${table} insert @${i}: ${error.message}`)
  }
}

async function main() {
  console.log('Origen (Cheques):', SRC_URL)
  console.log('Destino (Winston):', DST_URL)

  for (const { name, order } of TABLES) {
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
    const rows = await fetchAll(src, name, order)
    await insertChunks(dst, name, rows)
    const after = await countTable(dst, name)
    console.log(`  → INSERT ${rows.length} (destino ahora ${after})`)
  }

  // Ajustar secuencias BIGSERIAL
  const seqSql = `
SELECT setval(pg_get_serial_sequence('ch_nombres','id'), COALESCE((SELECT MAX(id) FROM ch_nombres), 1));
SELECT setval(pg_get_serial_sequence('ch_conceptos','id'), COALESCE((SELECT MAX(id) FROM ch_conceptos), 1));
SELECT setval(pg_get_serial_sequence('ch_subconceptos','id'), COALESCE((SELECT MAX(id) FROM ch_subconceptos), 1));
SELECT setval(pg_get_serial_sequence('cheques_banco','id'), COALESCE((SELECT MAX(id) FROM cheques_banco), 1));
`
  try {
    execSync(`npx -y @insforge/cli db query ${JSON.stringify(seqSql)} --json`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    console.log('✓ Secuencias BIGSERIAL alineadas')
  } catch (e) {
    console.warn('⚠ Secuencias:', String(e.stderr || e.message || e).slice(0, 200))
  }

  console.log('\nMigración Cheques → Winston terminada.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
