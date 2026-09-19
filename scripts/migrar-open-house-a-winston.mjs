/**
 * Copia tablas Open_House (ebcv45bg) → Winston Servicios (g4ta4bfg).
 * Solo INSERT si destino vacío. Sin UPDATE/DELETE/TRUNCATE.
 *
 * Uso: node --env-file=.env.local scripts/migrar-open-house-a-winston.mjs
 */
import { createAdminClient } from '@insforge/sdk'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OH_PROJECT_ID = '7644e58c-44a4-4301-8bcf-47ab5f10a039'
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
  ...loadEnvFile(path.join('/home/mario/Proyectos/open_house', '.env.local')),
  ...process.env,
}

let SRC_URL = (env.INSFORGE_OPEN_HOUSE_URL || '').replace(/\/$/, '')
let SRC_KEY = env.INSFORGE_OPEN_HOUSE_API_KEY || ''
let DST_URL = (env.NEXT_PUBLIC_INSFORGE_URL || env.INSFORGE_URL || '').replace(/\/$/, '')
let DST_KEY = env.INSFORGE_API_KEY || ''

if (!SRC_URL || !SRC_KEY) {
  console.log('Obteniendo credenciales origen (Open_House) vía CLI…')
  const cfg = linkProject(OH_PROJECT_ID)
  SRC_URL = String(cfg?.oss_host || '').replace(/\/$/, '')
  SRC_KEY = cfg?.api_key || ''
}

if (!DST_URL?.includes('g4ta4bfg') || !DST_KEY) {
  console.log('Obteniendo credenciales destino (Winston) vía CLI…')
  const cfg = linkProject(WINSTON_PROJECT_ID)
  DST_URL = String(cfg?.oss_host || '').replace(/\/$/, '')
  DST_KEY = cfg?.api_key || ''
} else {
  linkProject(WINSTON_PROJECT_ID)
}

if (!SRC_URL?.includes('ebcv45bg') || !SRC_KEY) {
  console.error('✗ Origen debe ser NANO Open_House (ebcv45bg)')
  process.exit(1)
}
if (!DST_URL?.includes('g4ta4bfg') || !DST_KEY) {
  console.error('✗ Destino debe ser Winston (g4ta4bfg)')
  process.exit(1)
}

const src = createAdminClient({ baseUrl: SRC_URL, apiKey: SRC_KEY }).database
const dst = createAdminClient({ baseUrl: DST_URL, apiKey: DST_KEY }).database

const TABLES = [
  { name: 'inscripciones', order: 'created_at' },
  { name: 'sesiones', order: 'created_at' },
  { name: 'kommo_lead_tracking', order: 'created_at' },
  { name: 'campamento_verano', order: 'created_at' },
  { name: 'taller_ia', order: 'created_at' },
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
  const chunkSize = 100
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await db.from(table).insert(chunk)
    if (error) throw new Error(`${table} insert @${i}: ${error.message}`)
  }
}

async function main() {
  console.log('Origen (Open_House):', SRC_URL)
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

  console.log('\nMigración Open_House → Winston terminada.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
