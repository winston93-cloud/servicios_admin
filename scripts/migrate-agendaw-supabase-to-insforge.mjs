#!/usr/bin/env node
/**
 * Copia tablas AgendaW: Supabase (producción agendaw) → InsForge (proyecto AgendaW).
 *
 * Uso:
 *   node scripts/migrate-agendaw-supabase-to-insforge.mjs
 *   node scripts/migrate-agendaw-supabase-to-insforge.mjs --verify
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@insforge/sdk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const AGENDAW_ROOT = path.resolve(ROOT, '../agendaw')

function loadAgendawEnv() {
  const p = path.join(AGENDAW_ROOT, '.env.local')
  if (!fs.existsSync(p)) throw new Error('Falta agendaw/.env.local')
  const env = {}
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[t.slice(0, i).trim()] = v
  }
  return env
}

function loadAgendawInsforge() {
  const p = path.join(AGENDAW_ROOT, '.insforge/project.json')
  if (!fs.existsSync(p)) throw new Error('Falta agendaw/.insforge/project.json — enlaza: cd agendaw && insforge link ...')
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

/** Padres antes que hijos (FK). */
const TABLAS = [
  { table: 'admission_appointments', pk: 'id' },
  { table: 'blocked_dates', pk: 'id' },
  { table: 'admission_schedules', pk: 'id' },
  { table: 'tour_recorridos', pk: 'id' },
  { table: 'wsp', pk: 'id' },
  { table: 'admission_permission_requests', pk: 'id' },
  { table: 'expediente_inicial', pk: 'id' },
]

const PAGE = 1000
const BATCH = 200
const BATCH_SMALL = 5

async function countSupabase(sb, table) {
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`${table} count: ${error.message}`)
  return count ?? 0
}

async function fetchAll(sb, table, pk) {
  const total = await countSupabase(sb, table)
  if (total === 0) return []
  const rows = []
  for (let from = 0; from < total; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select('*')
      .order(pk, { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`${table} read: ${error.message}`)
    rows.push(...(data ?? []))
    process.stdout.write(`\r  leyendo ${table}: ${rows.length}/${total}`)
  }
  process.stdout.write('\n')
  return rows
}

const TABLE_COLUMNS = {
  wsp: ['id', 'ctrl', 'qr', 'estatus', 'status', 'created_at'],
  expediente_inicial: [
    'id', 'appointment_id', 'nivel', 'grado', 'ciclo_escolar', 'nombre_alumno',
    'apellido_paterno_alumno', 'apellido_materno_alumno', 'fecha_nacimiento', 'lugar_nacimiento',
    'sexo', 'edad', 'escuela_procedencia', 'padre_nombre', 'padre_apellido_paterno',
    'padre_apellido_materno', 'padre_edad', 'padre_email', 'padre_lugar_trabajo',
    'padre_estado_civil', 'padre_telefono_trabajo', 'padre_telefono_celular', 'madre_nombre',
    'madre_apellido_paterno', 'madre_apellido_materno', 'madre_edad', 'madre_email',
    'madre_lugar_trabajo', 'madre_estado_civil', 'madre_telefono_trabajo', 'madre_telefono_celular',
    'tratamiento_medico_ultimo_ano', 'tratamiento_psicologico_si', 'tratamiento_psicologico_razon',
    'clase_extracurricular', 'nombre_escuela_guarderia', 'motivo_separacion', 'motivo_incorporacion',
    'preocupacion_desenvolvimiento', 'nombre_persona_info', 'relacion_alumno', 'conductas',
    'conductas_proceso_control', 'padre_trabaja_fuera_ciudad', 'madre_trabaja_fuera_ciudad',
    'alergias_padecimientos', 'diagnosticos_medicos', 'num_familiares_adicionales',
    'lugar_ocupa_aspirante', 'edades_familiares', 'familiar_1_nombre', 'familiar_1_apellidos',
    'familiar_1_edad', 'familiar_2_nombre', 'familiar_2_apellidos', 'familiar_2_edad',
    'familiar_3_nombre', 'familiar_3_apellidos', 'familiar_3_edad', 'familiar_4_nombre',
    'familiar_4_apellidos', 'familiar_4_edad', 'telefono_principal', 'created_at', 'updated_at',
  ],
}

/** InsForge bulk-upsert trata "" como NULL; columnas NOT NULL necesitan valor. */
function sanitizeRows(table, rows) {
  const textNotNull = {
    admission_appointments: [
      'campus', 'level', 'grade_level', 'student_name', 'student_age',
      'parent_name', 'parent_email', 'parent_phone', 'relationship',
      'appointment_time', 'status',
    ],
    tour_recorridos: ['level', 'tour_time', 'parent_name', 'parent_phone', 'parent_email'],
    wsp: ['estatus', 'status'],
  }
  const cols = textNotNull[table]
  const allowed = TABLE_COLUMNS[table]

  return rows.map((row) => {
    let r = { ...row }
    if (allowed) {
      r = {}
      for (const k of allowed) if (k in row) r[k] = row[k]
    }
    if (cols) {
      for (const k of cols) {
        if (r[k] === '' || r[k] == null) r[k] = ' '
      }
    }
    if (table === 'admission_appointments' && (r.origin === '' || r.origin == null)) {
      r.origin = 'legacy'
    }
    if (table === 'expediente_inicial') {
      if (typeof r.conductas === 'string') {
        try { r.conductas = JSON.parse(r.conductas) } catch { r.conductas = [] }
      }
      if (r.conductas == null) r.conductas = []
      for (const k of Object.keys(r)) {
        if (r[k] === '') r[k] = null
      }
    }
    return r
  })
}

async function bulkUpsert(baseUrl, apiKey, table, upsertKey, rows) {
  if (!rows.length) return
  const payload = sanitizeRows(table, rows)
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

async function countInsforge(baseUrl, apiKey, table) {
  const res = await fetch(`${baseUrl}/api/database/records/${table}?select=${table === 'wsp' ? 'id' : 'id'}&limit=0`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      apikey: apiKey,
      Prefer: 'count=exact',
    },
  })
  if (!res.ok) return -1
  const range = res.headers.get('content-range')
  if (!range) return -1
  const m = range.match(/\/(\d+)$/)
  return m ? Number(m[1]) : -1
}

async function migrateTable(sb, cfg, def) {
  const { table, pk } = def
  const t0 = Date.now()
  console.log(`\n▶ ${table}`)

  const rows = await fetchAll(sb, table, pk)
  if (!rows.length) {
    console.log('  (vacía en Supabase)')
    return { table, origen: 0, destino: 0 }
  }

  const payload = sanitizeRows(table, rows)

  if (table === 'expediente_inicial') {
    const db = createAdminClient({ baseUrl: cfg.oss_host, apiKey: cfg.api_key }).database
    let sent = 0
    for (const row of payload) {
      const copy = { ...row }
      if (typeof copy.conductas === 'string') {
        try { copy.conductas = JSON.parse(copy.conductas) } catch { copy.conductas = [] }
      }
      const { error } = await db.from('expediente_inicial').upsert([copy], { onConflict: 'id' })
      if (error) throw new Error(`expediente_inicial ${row.id}: ${error.message}`)
      sent++
      process.stdout.write(`\r  escribiendo expediente_inicial: ${sent}/${payload.length}`)
    }
    process.stdout.write('\n')
  } else {
    const batchSize = BATCH
    let sent = 0
    for (let i = 0; i < payload.length; i += batchSize) {
      const chunk = payload.slice(i, i + batchSize)
      await bulkUpsert(cfg.oss_host, cfg.api_key, table, pk, chunk)
      sent += chunk.length
      process.stdout.write(`\r  escribiendo ${table}: ${sent}/${payload.length}`)
    }
    process.stdout.write('\n')
  }

  const destino = await countInsforge(cfg.oss_host, cfg.api_key, table)
  const ok = destino === rows.length
  console.log(`  ✓ ${rows.length} filas → InsForge=${destino} ${ok ? '' : '⚠ DESAJUSTE'} (${Date.now() - t0}ms)`)
  return { table, origen: rows.length, destino, ok }
}

async function main() {
  const verify = process.argv.includes('--verify')
  const only = process.argv.find((a) => a.startsWith('--table='))?.split('=')[1]
  const env = loadAgendawEnv()
  const cfg = loadAgendawInsforge()

  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  let defs = TABLAS
  if (only) {
    defs = TABLAS.filter((d) => d.table === only)
    if (!defs.length) throw new Error(`Tabla desconocida: ${only}`)
  }

  if (verify) {
    console.log('\n=== Verificación Supabase vs InsForge AgendaW ===\n')
    let fails = 0
    for (const def of TABLAS) {
      const sbN = await countSupabase(sb, def.table)
      const ifN = await countInsforge(cfg.oss_host, cfg.api_key, def.table)
      const ok = sbN === ifN
      if (!ok) fails++
      console.log(`${def.table.padEnd(32)} supabase=${String(sbN).padStart(4)}  insforge=${String(ifN).padStart(4)}  ${ok ? '✓' : '✗'}`)
    }
    process.exit(fails ? 1 : 0)
  }

  console.log('Migración AgendaW: Supabase → InsForge')
  console.log(`  Origen:  ${env.NEXT_PUBLIC_SUPABASE_URL}`)
  console.log(`  Destino: ${cfg.project_name} (${cfg.oss_host})`)

  for (const def of defs) {
    await migrateTable(sb, cfg, def)
  }

  console.log('\n=== Verificación final ===')
  for (const def of TABLAS) {
    const sbN = await countSupabase(sb, def.table)
    const ifN = await countInsforge(cfg.oss_host, cfg.api_key, def.table)
    console.log(`  ${def.table}: ${sbN} → ${ifN} ${sbN === ifN ? '✓' : '✗'}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
