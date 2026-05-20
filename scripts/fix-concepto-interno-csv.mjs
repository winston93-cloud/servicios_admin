#!/usr/bin/env node
/**
 * CSV concepto_interno (phpMyAdmin) → Supabase
 * Renombra Visible → visible, Orden_Visible → orden_visible
 *
 * node scripts/fix-concepto-interno-csv.mjs ~/concepto_interno.csv
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const OUT_COLS = ['concepto_id', 'concepto_clase', 'visible', 'orden_visible']

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

const path = process.argv[2]
if (!path) {
  console.error('Uso: node scripts/fix-concepto-interno-csv.mjs <archivo.csv>')
  process.exit(1)
}

const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
const lines = raw.split(/\r?\n/).filter((l) => l.trim())
const header = parseCsvLine(lines[0]).map((h) => h.trim())
const idx = (name) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase())

const iId = idx('concepto_id')
const iClase = idx('concepto_clase')
const iVis = idx('visible') >= 0 ? idx('visible') : idx('Visible')
const iOrd = idx('orden_visible') >= 0 ? idx('orden_visible') : idx('Orden_Visible')

const out = [OUT_COLS.join(',')]
for (let n = 1; n < lines.length; n++) {
  const row = parseCsvLine(lines[n])
  if (!row.length || row.every((c) => !c.trim())) continue
  out.push(
    [
      row[iId]?.trim(),
      row[iClase]?.trim(),
      row[iVis]?.trim() || '1',
      row[iOrd]?.trim() || '0',
    ]
      .map(escapeCsvField)
      .join(',')
  )
}

const outPath = join(dirname(path), basename(path, '.csv') + '_supabase.csv')
writeFileSync(outPath, out.join('\n') + '\n', 'utf8')
console.log('Archivo generado:', outPath)
console.log('Filas de datos:', out.length - 1)
console.log('Importa en concepto_interno antes que precios y pagos.')
