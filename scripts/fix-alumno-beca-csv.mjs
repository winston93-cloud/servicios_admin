#!/usr/bin/env node
/**
 * Prepara CSV de phpMyAdmin para importar alumno_beca en Supabase.
 * Convierte texto "NULL" en celdas vacías y normaliza cabecera.
 *
 * Uso:
 *   node scripts/fix-alumno-beca-csv.mjs ~/Escritorio/alumno_beca.csv
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const COLUMNS = [
  'alumno_beca_id',
  'alumno_id',
  'beca_id',
  'beca_porcentaje',
  'beca_estatus',
  'beca_ciclo_escolar',
  'beca_registro',
  'beca_actualizacion',
  'beca_p',
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
        } else {
          inQuotes = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

function escapeCsvField(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCsvLine(fields) {
  return fields.map(escapeCsvField).join(',')
}

function cleanCell(v) {
  const s = (v ?? '').trim()
  if (s.toUpperCase() === 'NULL' || s === '\\N') return ''
  return s
}

function normalizeHeader(fields) {
  return fields.map((f) => cleanCell(f).toLowerCase())
}

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Uso: node scripts/fix-alumno-beca-csv.mjs <ruta/alumno_beca.csv>')
  process.exit(1)
}

const raw = readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, '')
const lines = raw.split(/\r?\n/).filter((l) => l.length > 0)
if (lines.length < 2) {
  console.error('El CSV no tiene filas de datos.')
  process.exit(1)
}

const headerNorm = normalizeHeader(parseCsvLine(lines[0]))
const headerOk =
  headerNorm.length === COLUMNS.length &&
  headerNorm.every((h, i) => h === COLUMNS[i] || h.replace(/_/g, '') === COLUMNS[i].replace(/_/g, ''))

const outLines = [toCsvLine(COLUMNS)]

for (let i = 1; i < lines.length; i++) {
  const cells = parseCsvLine(lines[i]).map(cleanCell)
  while (cells.length < COLUMNS.length) cells.push('')
  outLines.push(toCsvLine(cells.slice(0, COLUMNS.length)))
}

const outPath = join(dirname(inputPath), basename(inputPath, '.csv') + '_supabase.csv')
writeFileSync(outPath, outLines.join('\n') + '\n', 'utf8')

console.log('Archivo generado:', outPath)
console.log('Filas de datos:', outLines.length - 1)
if (!headerOk) {
  console.log('Aviso: la cabecera del CSV original no coincidía exactamente; se forzó el orden estándar.')
}
console.log('Importa: Supabase → Table Editor → alumno_beca →', basename(outPath))
