#!/usr/bin/env node
/**
 * Importa tablas de boletas desde MySQL winston_general → InsForge boletas.
 * Uso: node --env-file=/tmp/work.env insforge-boletas/scripts/import-boletas-from-mysql.mjs
 */
import { createAdminClient } from '@insforge/sdk'
import mysql from 'mysql2/promise'

const url = process.env.BOLETAS_INSFORGE_URL
const key = process.env.BOLETAS_INSFORGE_API_KEY
if (!url || !key) {
  console.error('Faltan BOLETAS_INSFORGE_URL / BOLETAS_INSFORGE_API_KEY')
  process.exit(1)
}

const client = createAdminClient({ baseUrl: url, apiKey: key })

const TABLES = [
  {
    name: 'boleta_inasistencia',
    sql: `SELECT i.alumno_id, i.materia_id, i.inasistencia_bimestre,
          i.calificacion_ciclo_escolar AS inasistencia_ciclo_escolar,
          i.inasistencia_cantidad, i.inasistencia_registro
          FROM boleta_inasistencia i
          INNER JOIN alumno a ON a.alumno_id = i.alumno_id
          INNER JOIN boleta_materia m ON m.materia_id = i.materia_id`,
    wipe: true,
    insertOnly: true,
  },
  {
    name: 'boleta_conducta',
    sql: `SELECT c.alumno_id, c.materia_id, c.conducta_bimestre,
          c.calificacion_ciclo_escolar AS conducta_ciclo_escolar,
          c.conducta_puntaje AS conducta_valor, c.conducta_registro
          FROM boleta_conducta c
          INNER JOIN alumno a ON a.alumno_id = c.alumno_id
          INNER JOIN boleta_materia m ON m.materia_id = c.materia_id`,
    wipe: true,
    insertOnly: true,
  },
  {
    name: 'boleta_comprension_lectora',
    // Expandimos comprension_1/2/3 → una fila por trimestre
    custom: 'comprension',
  },
  {
    name: 'boleta_recuperacion',
    sql: `SELECT cal.alumno_id, cal.materia_id,
          cal.calificacion_ciclo_escolar AS recuperacion_ciclo_escolar,
          r.recuperacion_puntos, r.recuperacion_registro
          FROM boleta_recuperacion r
          INNER JOIN boleta_calificacion cal ON cal.calificacion_id = r.calificacion_id
          INNER JOIN alumno a ON a.alumno_id = cal.alumno_id`,
    wipe: true,
    insertOnly: true,
  },
]

function cleanRow(row) {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined) continue
    if (v instanceof Date) {
      // invalid mysql dates
      if (Number.isNaN(v.getTime())) out[k] = null
      else out[k] = v.toISOString().slice(0, 19).replace('T', ' ')
    } else if (typeof v === 'string' && (v.startsWith('0000-00-00') || v.includes('-00'))) {
      out[k] = null
    } else {
      out[k] = v
    }
  }
  return out
}

async function upsert(table, rows, chunkSize = 150) {
  let done = 0
  let skipped = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize).map(cleanRow)
    const { error } = await client.database.from(table).upsert(chunk)
    if (error) {
      for (const row of chunk) {
        const r = await client.database.from(table).upsert([row])
        if (r.error) {
          const msg = r.error.message || ''
          if (/foreign key|violates/i.test(msg)) {
            skipped++
            continue
          }
          console.error(`\n${table} row error:`, msg, JSON.stringify(row).slice(0, 180))
          throw new Error(msg)
        }
        done++
      }
    } else {
      done += chunk.length
    }
    process.stdout.write(`\r${table}: ${done}/${rows.length} (skip ${skipped})`)
  }
  process.stdout.write('\n')
}

async function wipeTable(table) {
  // raw delete via unrestricted SQL
  const res = await fetch(`${url}/api/database/advance/rawsql/unrestricted`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: `TRUNCATE TABLE public.${table} RESTART IDENTITY CASCADE` }),
  })
  if (!res.ok) {
    const t = await res.text()
    // try delete all
    const res2 = await fetch(`${url}/api/database/advance/rawsql/unrestricted`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: `DELETE FROM public.${table}` }),
    })
    if (!res2.ok) console.warn('wipe warn', table, t.slice(0, 120), await res2.text())
  }
}

async function main() {
  const mysqlConn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'winston_general',
    dateStrings: true,
  })
  console.log('MySQL connected')

  for (const t of TABLES) {
    console.log(`\n→ ${t.name}`)
    if (t.wipe) await wipeTable(t.name)

    let rows
    if (t.custom === 'comprension') {
      const [raw] = await mysqlConn.query(`
        SELECT c.alumno_id, c.comprension_1, c.comprension_2, c.comprension_3,
               c.calificacion_ciclo_escolar
        FROM boleta_comprension_lectora c
        INNER JOIN alumno a ON a.alumno_id = c.alumno_id`)
      rows = []
      for (const r of raw) {
        for (const trim of [1, 2, 3]) {
          const v = r[`comprension_${trim}`]
          rows.push({
            alumno_id: r.alumno_id,
            comprension_trimestre: trim,
            comprension_ciclo_escolar: r.calificacion_ciclo_escolar,
            comprension_valor: v == null ? null : String(v),
          })
        }
      }
    } else {
      ;[rows] = await mysqlConn.query(t.sql)
    }

    console.log(`  mysql rows: ${rows.length}`)
    if (!rows.length) continue
    if (t.insertOnly) {
      let done = 0
      let skipped = 0
      const chunkSize = 150
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize).map(cleanRow)
        const { error } = await client.database.from(t.name).insert(chunk)
        if (error) {
          for (const row of chunk) {
            const r = await client.database.from(t.name).insert([row])
            if (r.error) {
              skipped++
              continue
            }
            done++
          }
        } else done += chunk.length
        process.stdout.write(`\r${t.name}: ${done}/${rows.length} (skip ${skipped})`)
      }
      process.stdout.write('\n')
    } else {
      await upsert(t.name, rows)
    }
  }

  // ensure bimestre row
  await client.database.from('boleta_bimestre').upsert([
    { bimestre_id: 1, bimestre_activo: 1, bimestre_etiqueta: 'Periodo activo' },
  ])

  await mysqlConn.end()
  console.log('\nListo.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
