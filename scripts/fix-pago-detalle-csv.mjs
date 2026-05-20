#!/usr/bin/env node
/**
 * CSV pago_detalle (phpMyAdmin) → Supabase
 *
 * node scripts/fix-pago-detalle-csv.mjs ~/pago_detalle.csv
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const COLUMNS = [
  'pago_id',
  'alumno_id',
  'pago_nombre',
  'pago_referencia',
  'pago_importe',
  'pago_recargo',
  'pago_forma',
  'pago_folio',
  'pago_fecha',
  'pago_hora',
  'pago_emisora',
  'pago_cancelado',
  'pago_registro',
  'pago_actualizacion',
  'facturo',
  'fact',
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

  if (key === 'pago_referencia') {
    return s.replace(/\D/g, '').padStart(12, '0').slice(-12)
  }

  if (key === 'pago_cancelado' && s === '') return '0'
  if ((key === 'facturo' || key === 'fact') && s === '') return ''
  return s
}

const path = process.argv[2]
if (!path) {
  console.error('Uso: node scripts/fix-pago-detalle-csv.mjs <archivo.csv>')
  process.exit(1)
}

const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
const lines = raw.split(/\r?\n/).filter((l) => l.trim())
const header = parseCsvLine(lines[0]).map((h) => h.trim())
const colIndex = {}
for (const c of COLUMNS) {
  const i = header.findIndex((h) => h.toLowerCase() === c.toLowerCase())
  if (i < 0) {
    console.error('Falta columna:', c, '| Cabeceras:', header.join(', '))
    process.exit(1)
  }
  colIndex[c] = i
}

const out = [COLUMNS.join(',')]
for (let n = 1; n < lines.length; n++) {
  const row = parseCsvLine(lines[n])
  if (!row.length || row.every((c) => !c.trim())) continue
  out.push(toCsvLine(COLUMNS.map((key) => cleanCell(row[colIndex[key]], key))))
}

const outPath = join(dirname(path), basename(path, '.csv') + '_supabase.csv')
writeFileSync(outPath, out.join('\n') + '\n', 'utf8')
console.log('Archivo generado:', outPath)
console.log('Filas de datos:', out.length - 1)
console.log('Importa concepto_boucher antes que pago_detalle.')
