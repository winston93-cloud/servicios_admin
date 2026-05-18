#!/usr/bin/env node
/**
 * Genera INSERT SQL para alumno_beca (plan B si falla import CSV en Supabase).
 * Uso: node scripts/generate-alumno-beca-sql.mjs ~/Escritorio/alumno_beca_supabase.csv
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

function parseLine(line) {
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

function esc(s) {
  return `'${String(s).replace(/'/g, "''")}'`
}

const input = process.argv[2]
if (!input) {
  console.error('Uso: node scripts/generate-alumno-beca-sql.mjs <alumno_beca_supabase.csv>')
  process.exit(1)
}

const raw = readFileSync(input, 'utf8').replace(/^\uFEFF/, '')
const lines = raw.split(/\r?\n/).filter(Boolean)
const header = parseLine(lines[0])
const cols = header.map((h) => h.trim())

const out = [
  '-- Import alumno_beca (ejecutar en Supabase SQL Editor)',
  '-- Si falla por FK, primero importa/migra public.alumno',
  '',
  'INSERT INTO public.alumno_beca (',
  cols.join(', '),
  ') VALUES',
]

const valueLines = []
for (let i = 1; i < lines.length; i++) {
  const cells = parseLine(lines[i])
  if (cells.length < cols.length) continue
  const row = cols.map((col, idx) => {
    const v = (cells[idx] ?? '').trim()
    if (['alumno_beca_id', 'alumno_id', 'beca_id', 'beca_porcentaje', 'beca_estatus', 'beca_ciclo_escolar'].includes(col)) {
      return v || '0'
    }
    if (col === 'beca_p') return esc(v || '0')
    if (col === 'beca_registro' || col === 'beca_actualizacion') {
      const fecha = !v || v.startsWith('0000-00-00') ? '1970-01-01 00:00:00' : v
      return `${esc(fecha)}::timestamp`
    }
    return esc(v)
  })
  valueLines.push(`(${row.join(', ')})`)
}

out.push(valueLines.join(',\n'))
out.push('ON CONFLICT (alumno_id) DO NOTHING;')
out.push('')

const outPath = join(dirname(input), basename(input, '.csv') + '_insert.sql')
writeFileSync(outPath, out.join('\n'), 'utf8')
console.log('SQL generado:', outPath, `(${valueLines.length} filas)`)
