#!/usr/bin/env node
/**
 * CSV concepto_boucher (phpMyAdmin) → Supabase
 *
 * node scripts/fix-concepto-boucher-csv.mjs ~/concepto_boucher.csv
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const OUT_COLS = [
  'concepto_id',
  'concepto_no',
  'concepto_clase',
  'alumno_nivel',
  'concepto_tipo',
  'concepto_descuento',
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

const path = process.argv[2]
if (!path) {
  console.error('Uso: node scripts/fix-concepto-boucher-csv.mjs <archivo.csv>')
  process.exit(1)
}

const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
const lines = raw.split(/\r?\n/).filter((l) => l.trim())
const header = parseCsvLine(lines[0]).map((h) => h.trim())
const idx = (name) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase())

const cols = OUT_COLS.map((c) => idx(c))
if (cols.some((i) => i < 0)) {
  console.error('Cabeceras esperadas:', OUT_COLS.join(', '))
  console.error('Encontradas:', header.join(', '))
  process.exit(1)
}

const out = [OUT_COLS.join(',')]
for (let n = 1; n < lines.length; n++) {
  const row = parseCsvLine(lines[n])
  if (!row.length || row.every((c) => !c.trim())) continue
  out.push(
    OUT_COLS.map((_, i) => {
      let s = row[cols[i]]?.trim() ?? ''
      if (s.toUpperCase() === 'NULL') s = ''
      if (OUT_COLS[i] === 'alumno_nivel' && s === '') s = '0'
      if (OUT_COLS[i] === 'concepto_descuento' && s === '') s = '0'
      return s
    })
      .map(escapeCsvField)
      .join(',')
  )
}

const outPath = join(dirname(path), basename(path, '.csv') + '_supabase.csv')
writeFileSync(outPath, out.join('\n') + '\n', 'utf8')
console.log('Archivo generado:', outPath)
console.log('Filas de datos:', out.length - 1)
