#!/usr/bin/env node
/**
 * Prepara CSV pago_interno (phpMyAdmin) → Supabase.
 * Convierte NULL, fechas 0000-00-00 y deja columnas en orden estándar.
 *
 * Uso:
 *   node scripts/fix-pago-interno-csv.mjs ~/pago_interno.csv
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const COLUMNS = [
  'pago_id',
  'alumno_id',
  'concepto_id',
  'concepto_otro',
  'pago_folio',
  'pago_importe',
  'pago_fecha',
  'pago_cancelado',
  'pago_ciclo_escolar',
  'pago_registro',
  'pago_actualizacion',
]

const FECHA_FALLBACK = '1970-01-01'

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

function esFechaInvalida(s) {
  const t = s.trim()
  return !t || t.startsWith('0000-00-00')
}

function cleanCell(v, key) {
  let s = (v ?? '').trim()
  if (s.toUpperCase() === 'NULL' || s === '\\N') s = ''

  if (key === 'pago_fecha' || key === 'pago_registro' || key === 'pago_actualizacion') {
    if (esFechaInvalida(s)) {
      return key === 'pago_fecha' ? '' : FECHA_FALLBACK
    }
    if (key === 'pago_fecha' && s.includes(' ')) return s.slice(0, 10)
    return s
  }

  if (key === 'pago_cancelado' && s === '') return '0'
  return s
}

function cleanRowCells(cells) {
  return COLUMNS.map((col, i) => cleanCell(cells[i] ?? '', col))
}

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Uso: node scripts/fix-pago-interno-csv.mjs <ruta/pago_interno.csv>')
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
  outLines.push(toCsvLine(cleanRowCells(parsed)))
}

const outPath = join(dirname(inputPath), basename(inputPath, '.csv') + '_supabase.csv')
writeFileSync(outPath, outLines.join('\n') + '\n', 'utf8')
console.log('Archivo generado:', outPath)
console.log('Filas de datos:', outLines.length - 1)
console.log('Importa al final en pago_interno (requiere concepto_interno y alumno migrados).')
