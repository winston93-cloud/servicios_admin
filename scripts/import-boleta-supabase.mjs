#!/usr/bin/env node
/**
 * Importa boleta_materia, boleta_maestro y boleta_maestro_grupo a Supabase.
 * Ejecutar antes: sql/boleta_maestros_add.sql en el SQL Editor.
 *
 * node scripts/import-boleta-supabase.mjs [materia.csv] [maestro.csv] [grupo.csv]
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadEnv() {
  const raw = readFileSync(join(root, '.env.local'), 'utf8')
  const get = (k) => (raw.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim()
  const url = get('NEXT_PUBLIC_SUPABASE_URL')
  const key =
    get('SUPABASE_SERVICE_ROLE_KEY') ||
    get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!url || !key) throw new Error('Faltan URL o clave Supabase en .env.local')
  return { url, key }
}

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out
}

function esFechaInvalida(s) {
  const t = String(s ?? '').trim()
  if (!t || t.startsWith('0000-00-00')) return true
  if (/-00/.test(t)) return true
  return false
}

const CAMPOS_FECHA = new Set([
  'materia_registro',
  'maestro_registro',
  'grupo_registro',
])

const CAMPOS_TEXTO_VACIO_NULL = new Set([
  'maestro_app',
  'maestro_apm',
  'maestro_nombre',
  'maestro_usuario',
  'maestro_clave',
  'maestro_celular',
  'maestro_email',
  'grupo_letra',
])

function readCsv(path) {
  const lines = readFileSync(path, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
  const header = parseCsvLine(lines[0])
  const rows = []
  for (let n = 1; n < lines.length; n++) {
    const cells = parseCsvLine(lines[n])
    if (!cells.length) continue
    const row = {}
    header.forEach((h, i) => {
      let v = cells[i]?.trim() ?? ''
      if (v === '' || v === 'NULL') {
        row[h] = CAMPOS_TEXTO_VACIO_NULL.has(h) ? null : null
      } else if (/^-?\d+$/.test(v)) row[h] = Number(v)
      else if (CAMPOS_FECHA.has(h) && esFechaInvalida(v)) row[h] = null
      else if (CAMPOS_FECHA.has(h)) row[h] = v.slice(0, 10)
      else if (h === 'maestro_celular' && (v === '0' || v === '0')) row[h] = null
      else row[h] = v
    })
    rows.push(row)
  }
  return rows
}

async function ensureTablas(sb) {
  for (const t of ['boleta_materia', 'boleta_maestro', 'boleta_maestro_grupo']) {
    const { error } = await sb.from(t).select('*').limit(0)
    if (error?.code === '42P01') {
      console.error(
        `La tabla public.${t} no existe.\n` +
          'Ejecuta sql/boleta_maestros_add.sql en el SQL Editor de Supabase y vuelve a correr este script.'
      )
      process.exit(1)
    }
    if (error) throw new Error(`${t}: ${error.message ?? JSON.stringify(error)}`)
  }
}

async function upsertLotes(sb, tabla, pk, filas, tam = 200) {
  for (let i = 0; i < filas.length; i += tam) {
    const lote = filas.slice(i, i + tam)
    const { error } = await sb.from(tabla).upsert(lote, { onConflict: pk })
    if (error) {
      throw new Error(
        `${tabla} filas ${i + 1}: ${error.message ?? JSON.stringify(error)}`
      )
    }
    process.stdout.write(`\r${tabla}: ${Math.min(i + tam, filas.length)} / ${filas.length}`)
  }
  console.log('')
}

const { url, key } = loadEnv()
const sb = createClient(url, key, { auth: { persistSession: false } })

const materiaPath =
  process.argv[2] || join(root, 'data/boletas/boleta_materia.csv')
const maestroPath =
  process.argv[3] || join(root, 'data/boletas/boleta_maestro.csv')
const grupoPath =
  process.argv[4] || join(root, 'data/boletas/boleta_maestro_grupo.csv')

await ensureTablas(sb)

const materias = readCsv(materiaPath)
const maestros = readCsv(maestroPath)
const grupos = readCsv(grupoPath)

console.log('Importando boleta_materia…', materias.length)
await upsertLotes(sb, 'boleta_materia', 'materia_id', materias)

console.log('Importando boleta_maestro…', maestros.length)
await upsertLotes(sb, 'boleta_maestro', 'maestro_id', maestros)

console.log('Importando boleta_maestro_grupo…', grupos.length)
await upsertLotes(sb, 'boleta_maestro_grupo', 'grupo_id', grupos)

console.log('Listo.')
