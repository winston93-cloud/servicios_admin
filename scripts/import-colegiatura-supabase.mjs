#!/usr/bin/env node
/**
 * Crea tablas (SQL) e importa concepto_boucher + pago_detalle a Supabase.
 * Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y clave service role.
 *
 * node scripts/import-colegiatura-supabase.mjs [concepto_supabase.csv] [pago_supabase.csv]
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
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    const day = parseInt(m[3], 10)
    if (day < 1 || day > 31) return true
  }
  return false
}

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
      if (v === '') {
        row[h] = h === 'facturo' || h === 'fact' ? '' : null
      }       else if (/^-?\d+$/.test(v)) row[h] = Number(v)
      else if (/^-?\d+\.\d+$/.test(v)) row[h] = Number(v)
      else if (
        (h === 'pago_fecha' || h === 'pago_registro' || h === 'pago_actualizacion') &&
        esFechaInvalida(v)
      ) {
        row[h] = h === 'pago_fecha' ? null : '1970-01-01'
      } else row[h] = v
    })
    rows.push(row)
  }
  return rows
}

async function upsertLotes(sb, tabla, pk, filas, tam = 500) {
  for (let i = 0; i < filas.length; i += tam) {
    const lote = filas.slice(i, i + tam)
    const { error } = await sb.from(tabla).upsert(lote, { onConflict: pk })
    if (error) throw new Error(`${tabla} filas ${i + 1}: ${error.message}`)
    process.stdout.write(`\r${tabla}: ${Math.min(i + tam, filas.length)} / ${filas.length}`)
  }
  console.log('')
}

const { url, key } = loadEnv()
const sb = createClient(url, key, { auth: { persistSession: false } })

const conceptosPath =
  process.argv[2] || join(root, 'data/concepto_boucher_supabase.csv')
const pagosPath = process.argv[3] || join(root, 'data/pago_detalle_supabase.csv')

const conceptos = readCsv(conceptosPath)
const pagos = readCsv(pagosPath)

console.log('Importando concepto_boucher…', conceptos.length)
await upsertLotes(sb, 'concepto_boucher', 'concepto_id', conceptos)

console.log('Importando pago_detalle…', pagos.length)
await upsertLotes(sb, 'pago_detalle', 'pago_id', pagos, 300)

console.log('Listo. Ejecuta en SQL Editor el setval de pago_detalle_add.sql si aplica.')
