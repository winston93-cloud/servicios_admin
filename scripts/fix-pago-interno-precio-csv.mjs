#!/usr/bin/env node
/**
 * Prepara CSV pago_interno_precio (phpMyAdmin) → Supabase.
 *
 * Uso:
 *   node scripts/fix-pago-interno-precio-csv.mjs ~/pago_interno_precio.csv
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const COLUMNS = [
  'precio_interno_id',
  'alumno_nivel',
  'alumno_grado',
  'concepto_id',
  'precio_interno',
  'precio_ciclo_escolar',
]

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

function escapeCsvField(value) {
  const s = value == null ? '' : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsvLine(fields) {
  return fields.map(escapeCsvField).join(',')
}

function cleanCell(v) {
  let s = (v ?? '').trim()
  if (s.toUpperCase() === 'NULL' || s === '\\N') return ''
  return s
}

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Uso: node scripts/fix-pago-interno-precio-csv.mjs <ruta/pago_interno_precio.csv>')
  process.exit(1)
}

const raw = readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, '')
const lines = raw.split(/\r?\n/).filter((l) => l.length > 0)
if (lines.length < 2) {
  console.error('El CSV no tiene filas de datos.')
  process.exit(1)
}

const outLines = [toCsvLine(COLUMNS)]
for (let i = 1; i < lines.length; i++) {
  const parsed = parseCsvLine(lines[i])
  while (parsed.length < COLUMNS.length) parsed.push('')
  outLines.push(toCsvLine(parsed.map(cleanCell)))
}

const outPath = join(dirname(inputPath), basename(inputPath, '.csv') + '_supabase.csv')
writeFileSync(outPath, outLines.join('\n') + '\n', 'utf8')
console.log('Archivo generado:', outPath)
console.log('Filas de datos:', outLines.length - 1)
console.log('Importa primero concepto_interno, luego este archivo en pago_interno_precio.')
