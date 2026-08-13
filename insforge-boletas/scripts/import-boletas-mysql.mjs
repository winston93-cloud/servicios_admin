#!/usr/bin/env node
/**
 * Importa catálogo/datos de boletas al proyecto InsForge «boletas».
 *
 *   BOLETAS_INSFORGE_URL=... BOLETAS_INSFORGE_API_KEY=... \
 *     node insforge-boletas/scripts/import-boletas-mysql.mjs --csv-dir data/boletas
 */
import { createAdminClient } from '@insforge/sdk'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

const url = process.env.BOLETAS_INSFORGE_URL || process.env.NEXT_PUBLIC_BOLETAS_INSFORGE_URL
const key = process.env.BOLETAS_INSFORGE_API_KEY || process.env.INSFORGE_BOLETAS_API_KEY

if (!url || !key) {
  console.error('Faltan BOLETAS_INSFORGE_URL y BOLETAS_INSFORGE_API_KEY')
  process.exit(1)
}

const args = process.argv.slice(2)
const csvDirIdx = args.indexOf('--csv-dir')
const csvDir = csvDirIdx >= 0 ? resolve(args[csvDirIdx + 1]) : resolve('data/boletas')

const client = createAdminClient({ baseUrl: url, apiKey: key })

const TABLE_ORDER = [
  'usuario',
  'alumno',
  'alumno_detalles',
  'alumno_familiar',
  'boleta_materia',
  'boleta_maestro',
  'boleta_maestro_grupo',
  'boleta_bimestre',
  'boleta_calificacion',
  'boleta_inasistencia',
  'boleta_conducta',
  'boleta_comprension_lectora',
  'boleta_recuperacion',
]

const INT_FIELDS = new Set([
  'usuario_id', 'perfil_id', 'usuario_status', 'nivel',
  'alumno_id', 'alumno_ref', 'alumno_nivel', 'alumno_grado', 'alumno_grupo',
  'alumno_status', 'alumno_nuevo_ingreso', 'alumno_ciclo_escolar', 'alumno_boleta',
  'mes', 'estatus_key', 'digito', 'hijo',
  'detalle_id', 'alumno_cp', 'tipo_relacion',
  'familiar_id', 'tutor_id', 'familiar_recibir_email',
  'materia_id', 'materia_nivel', 'materia_grado', 'materia_orden',
  'maestro_id', 'maestro_sexo',
  'grupo_id', 'bimestre_id', 'bimestre_activo',
  'calificacion_id', 'calificacion_bimestre', 'calificacion_ciclo_escolar',
  'inasistencia_id', 'inasistencia_bimestre', 'inasistencia_ciclo_escolar', 'inasistencia_cantidad',
  'conducta_id', 'conducta_bimestre', 'conducta_ciclo_escolar',
  'comprension_id', 'comprension_trimestre', 'comprension_ciclo_escolar',
  'recuperacion_id', 'recuperacion_ciclo_escolar',
])

const DATE_FIELDS = new Set([
  'alumno_registro', 'alumno_alta', 'detalle_registro',
  'materia_registro', 'maestro_registro', 'grupo_registro',
  'usuario_alta', 'familiar_fecha_nac', 'alumno_fecha_nac',
])

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
  return !t || t.startsWith('0000-00-00') || /-00/.test(t) || t === 'NULL'
}

function readCsv(filePath) {
  const lines = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return []
  const header = parseCsvLine(lines[0])
  const rows = []
  for (let n = 1; n < lines.length; n++) {
    const cells = parseCsvLine(lines[n])
    if (!cells.length) continue
    const row = {}
    header.forEach((h, i) => {
      let v = cells[i]?.trim() ?? ''
      if (v === '' || v === 'NULL') {
        row[h] = null
      } else if (DATE_FIELDS.has(h) && esFechaInvalida(v)) {
        row[h] = null
      } else if (DATE_FIELDS.has(h)) {
        row[h] = v.slice(0, 10)
      } else if (INT_FIELDS.has(h) && /^-?\d+$/.test(v)) {
        row[h] = Number(v)
      } else {
        row[h] = v
      }
    })
    rows.push(row)
  }
  return rows
}

async function upsertBatch(table, rows, chunkSize = 200) {
  if (!rows.length) return 0
  let done = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await client.database.from(table).upsert(chunk)
    if (error) {
      throw new Error(`${table} upsert: ${error.message || JSON.stringify(error)}`)
    }
    done += chunk.length
    process.stdout.write(`\r${table}: ${done}/${rows.length}`)
  }
  process.stdout.write('\n')
  return done
}

async function main() {
  if (!existsSync(csvDir)) {
    console.error('No existe csv-dir:', csvDir)
    process.exit(1)
  }
  const files = readdirSync(csvDir).filter((f) => f.endsWith('.csv'))
  console.log('CSV dir:', csvDir, '→', files.length, 'archivos')

  for (const table of TABLE_ORDER) {
    const file = join(csvDir, `${table}.csv`)
    if (!existsSync(file)) {
      console.log(`skip ${table} (sin CSV)`)
      continue
    }
    const rows = readCsv(file)
    console.log(`import ${table}: ${rows.length} filas`)
    await upsertBatch(table, rows)
  }
  console.log('Listo.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
