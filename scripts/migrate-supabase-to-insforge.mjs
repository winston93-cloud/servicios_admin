#!/usr/bin/env node
/**
 * Copia tablas Servicios: Supabase → InsForge (Winston Servicios).
 *
 * Uso:
 *   node scripts/migrate-supabase-to-insforge.mjs
 *   node scripts/migrate-supabase-to-insforge.mjs --table=pago_detalle
 *   node scripts/migrate-supabase-to-insforge.mjs --verify
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function loadEnvLocal() {
  const p = path.join(ROOT, '.env.local')
  if (!fs.existsSync(p)) throw new Error('Falta .env.local')
  const env = {}
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return env
}

function loadInsforgeConfig() {
  const p = path.join(ROOT, '.insforge/project.json')
  if (!fs.existsSync(p)) throw new Error('Falta .insforge/project.json')
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

/** Orden de dependencias (padres antes que hijos). */
const TABLAS = [
  { table: 'ciclos_escolares', pk: 'id' },
  { table: 'concepto_beca', pk: 'beca_id' },
  { table: 'concepto_boucher', pk: 'concepto_id' },
  { table: 'concepto_interno', pk: 'concepto_id' },
  { table: 'concepto_desayunos', pk: 'id' },
  { table: 'alumno', pk: 'alumno_id' },
  { table: 'alumno_detalles', pk: 'detalle_id' },
  { table: 'alumno_familiar', pk: 'familiar_id' },
  { table: 'alumno_contacto', pk: 'contacto_id' },
  { table: 'alumno_beca', pk: 'alumno_beca_id' },
  { table: 'pago_boucher_precio', pk: 'precio_id' },
  { table: 'pago_interno_precio', pk: 'precio_interno_id' },
  { table: 'boleta_materia', pk: 'materia_id' },
  { table: 'boleta_maestro', pk: 'maestro_id' },
  { table: 'boleta_maestro_grupo', pk: 'grupo_id' },
  { table: 'pago_detalle', pk: 'pago_id', batch: 500 },
  { table: 'pago_interno', pk: 'pago_id' },
  { table: 'pago_prorroga', pk: 'prorroga_id' },
  { table: 'personal', pk: 'id' },
  { table: 'pago_desayunos', pk: 'id' },
  { table: 'usuario', pk: 'usuario_id' },
  { table: 'banorte_pago_pendiente', pk: 'referencia' },
  { table: 'banorte_payw_intento', pk: 'id' },
  { table: 'openpay_webhook_verificacion', pk: 'id' },
  { table: 'openpay_webhook_log', pk: 'id' },
  { table: 'registro_salida_pie', pk: 'id' },
]

const DEFAULT_BATCH = 300
const PAGE = 1000

function parseArgs() {
  const only = process.argv.find((a) => a.startsWith('--table='))?.split('=')[1]
  const from = process.argv.find((a) => a.startsWith('--from='))?.split('=')[1]
  const verify = process.argv.includes('--verify')
  return { only, from, verify }
}

async function countSupabase(sb, table) {
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`${table} count: ${error.message}`)
  return count ?? 0
}

async function fetchPage(sb, table, pk, from, to) {
  const { data, error } = await sb.from(table).select('*').order(pk, { ascending: true }).range(from, to)
  if (error) throw new Error(`${table} read: ${error.message}`)
  return data ?? []
}

async function fetchAll(sb, table, pk) {
  const total = await countSupabase(sb, table)
  if (total === 0) return []
  const rows = []
  for (let from = 0; from < total; from += PAGE) {
    const chunk = await fetchPage(sb, table, pk, from, from + PAGE - 1)
    rows.push(...chunk)
    process.stdout.write(`\r  leyendo ${table}: ${rows.length}/${total}`)
  }
  process.stdout.write('\n')
  return rows
}

/** InsForge bulk-upsert trata "" como NULL en columnas NOT NULL. */
function sanitizeRows(table, rows) {
  const emptyToSpace = {
    alumno: ['secret_key', 'motivo', 'responsable'],
    pago_detalle: ['facturo', 'fact', 'pago_nombre', 'pago_forma', 'pago_folio', 'pago_hora', 'pago_emisora', 'pago_referencia'],
  }
  const cols = emptyToSpace[table]
  if (!cols) return rows
  return rows.map((row) => {
    const r = { ...row }
    for (const k of cols) {
      if (r[k] === '' || r[k] == null) r[k] = k === 'pago_referencia' ? '000000000000' : ' '
    }
    return r
  })
}

async function bulkUpsert(baseUrl, apiKey, table, upsertKey, rows) {
  if (!rows.length) return
  const payload = sanitizeRows(table, rows)
  if (!payload.length) return
  const json = JSON.stringify(payload)
  const blob = new Blob([json], { type: 'application/json' })
  const form = new FormData()
  form.append('file', blob, `${table}.json`)
  form.append('table', table)
  if (upsertKey) form.append('upsertKey', upsertKey)

  const res = await fetch(`${baseUrl}/api/database/advance/bulk-upsert`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${table} bulk-upsert ${res.status}: ${text.slice(0, 500)}`)
  }
}

async function countInsforge(table) {
  const sql = `SELECT count(*)::int AS n FROM public.${table}`
  const out = execSync(`npx @insforge/cli db query ${JSON.stringify(sql)} --json`, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const parsed = JSON.parse(out)
  return parsed.rows?.[0]?.n ?? -1
}

async function migrateTable(sb, cfg, def) {
  const { table, pk, batch = DEFAULT_BATCH } = def
  const t0 = Date.now()
  console.log(`\n▶ ${table}`)

  const rows = await fetchAll(sb, table, pk)
  if (!rows.length) {
    console.log(`  (vacía en Supabase, omitiendo datos)`)
    return { table, origen: 0, insertados: 0, ms: Date.now() - t0 }
  }

  let sent = 0
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch)
    await bulkUpsert(cfg.oss_host, cfg.api_key, table, pk, chunk)
    sent += chunk.length
    process.stdout.write(`\r  escribiendo ${table}: ${sent}/${rows.length}`)
  }
  process.stdout.write('\n')

  const destino = await countInsforge(table)
  const ok = destino === rows.length
  console.log(`  ✓ ${rows.length} filas → InsForge=${destino} ${ok ? '' : '⚠ DESAJUSTE'} (${Date.now() - t0}ms)`)
  return { table, origen: rows.length, insertados: destino, ok, ms: Date.now() - t0 }
}

async function verifyAll(sb, cfg, defs) {
  console.log('\n=== Verificación Supabase vs InsForge ===\n')
  console.log('tabla'.padEnd(28), 'supabase'.padStart(10), 'insforge'.padStart(10), 'ok')
  let fails = 0
  for (const def of defs) {
    const sbN = await countSupabase(sb, def.table)
    let ifN = -1
    try {
      ifN = await countInsforge(def.table)
    } catch {
      ifN = -1
    }
    const ok = sbN === ifN
    if (!ok) fails++
    console.log(def.table.padEnd(28), String(sbN).padStart(10), String(ifN).padStart(10), ok ? '✓' : '✗')
  }
  console.log(fails ? `\n${fails} tablas con diferencia` : '\nTodas coinciden')
  process.exit(fails ? 1 : 0)
}

async function main() {
  const { only, from, verify } = parseArgs()
  const env = loadEnvLocal()
  const cfg = loadInsforgeConfig()

  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  let defs = TABLAS
  if (only) {
    defs = TABLAS.filter((t) => t.table === only)
    if (!defs.length) throw new Error(`Tabla desconocida: ${only}`)
  } else if (from) {
    const idx = TABLAS.findIndex((t) => t.table === from)
    if (idx === -1) throw new Error(`Tabla desconocida: ${from}`)
    defs = TABLAS.slice(idx)
  }

  if (verify) {
    await verifyAll(sb, cfg, TABLAS)
    return
  }

  console.log('Migración Supabase → InsForge')
  console.log(`  Origen:  ${env.NEXT_PUBLIC_SUPABASE_URL}`)
  console.log(`  Destino: ${cfg.project_name} (${cfg.oss_host})`)
  console.log(`  Tablas:  ${defs.map((d) => d.table).join(', ')}`)

  const results = []
  for (const def of defs) {
    try {
      results.push(await migrateTable(sb, cfg, def))
    } catch (e) {
      console.error(`\n✗ Error en ${def.table}:`, e.message)
      process.exit(1)
    }
  }

  console.log('\n=== Resumen ===')
  for (const r of results) {
    console.log(`  ${r.table}: ${r.origen} → ${r.insertados ?? r.origen}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
