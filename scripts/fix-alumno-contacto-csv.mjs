#!/usr/bin/env node
/**
 * Arregla CSV exportado de phpMyAdmin para importar en Supabase (alumno_contacto).
 *
 * Problemas que corrige:
 * - Texto "NULL" → celda vacía
 * - Falta la columna tutor_id (todo se corre: TIA cae en tutor_id)
 *
 * Uso:
 *   node scripts/fix-alumno-contacto-csv.mjs ~/Descargas/alumno_contacto.csv
 *   → genera alumno_contacto_supabase.csv en la misma carpeta
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const COLUMNS = [
  'contacto_id',
  'alumno_id',
  'tutor_id',
  'tutor_clase',
  'contacto_tipo',
  'contacto_nombre',
  'contacto_tel',
  'contacto_cel',
  'contacto_alta',
  'contacto_actualizacion',
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

function isSmallIntLike(s) {
  const t = cleanCell(s)
  if (t === '') return true
  return /^-?\d+$/.test(t)
}

function normalizeHeader(fields) {
  return fields.map((f) => cleanCell(f).toLowerCase().replace(/\s+/g, '_'))
}

function needsInsertTutorIdColumn(headerNorm, sampleRow) {
  if (headerNorm.includes('tutor_id')) {
    const idx = headerNorm.indexOf('tutor_id')
    const sample = cleanCell(sampleRow[idx])
    if (sample !== '' && !isSmallIntLike(sample)) return true
    return false
  }
  if (sampleRow.length === COLUMNS.length - 1) return true
  const third = cleanCell(sampleRow[2])
  if (third !== '' && !isSmallIntLike(third)) return true
  return false
}

function fixRow(row, insertTutorId) {
  const cells = row.map(cleanCell)
  if (insertTutorId && cells.length === COLUMNS.length - 1) {
    return [...cells.slice(0, 2), '', ...cells.slice(2)]
  }
  while (cells.length < COLUMNS.length) cells.push('')
  return cells.slice(0, COLUMNS.length)
}

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Uso: node scripts/fix-alumno-contacto-csv.mjs <ruta/alumno_contacto.csv>')
  process.exit(1)
}

const raw = readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, '')
const lines = raw.split(/\r?\n/).filter((l) => l.length > 0)
if (lines.length < 2) {
  console.error('El CSV no tiene filas de datos.')
  process.exit(1)
}

const headerFields = parseCsvLine(lines[0])
const headerNorm = normalizeHeader(headerFields)
const firstData = parseCsvLine(lines[1])
const insertTutorId = needsInsertTutorIdColumn(headerNorm, firstData)

const outLines = [toCsvLine(COLUMNS)]
let fixed = 0

for (let i = 1; i < lines.length; i++) {
  const row = fixRow(parseCsvLine(lines[i]), insertTutorId)
  if (insertTutorId && parseCsvLine(lines[i]).length === COLUMNS.length - 1) fixed++
  outLines.push(toCsvLine(row))
}

const outPath = join(
  dirname(inputPath),
  basename(inputPath, '.csv') + '_supabase.csv'
)
writeFileSync(outPath, outLines.join('\n') + '\n', 'utf8')

console.log('Archivo generado:', outPath)
console.log('Filas de datos:', outLines.length - 1)
console.log(
  insertTutorId
    ? `Se insertó columna tutor_id vacía en filas con ${COLUMNS.length - 1} campos (${fixed} filas).`
    : 'Cabecera/columnas ya alineadas; solo se limpiaron NULL.'
)
console.log('Importa en Supabase: Table Editor → alumno_contacto →', basename(outPath))
