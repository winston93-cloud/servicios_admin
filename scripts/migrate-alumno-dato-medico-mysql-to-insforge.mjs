#!/usr/bin/env node
/**
 * Migra alumno_dato_medico: MySQL winston_general → InsForge Winston Servicios.
 *
 * Requiere: .env.local con MYSQL_* e INSFORGE_API_KEY / NEXT_PUBLIC_INSFORGE_URL
 *
 *   node scripts/migrate-alumno-dato-medico-mysql-to-insforge.mjs
 *   node scripts/migrate-alumno-dato-medico-mysql-to-insforge.mjs --verify
 *   node scripts/migrate-alumno-dato-medico-mysql-to-insforge.mjs --dry-run
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { createAdminClient } from '@insforge/sdk'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BATCH = 80

function loadEnvLocal() {
  const p = path.join(ROOT, '.env.local')
  if (!fs.existsSync(p)) throw new Error('Falta .env.local')
  const env = {}
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[t.slice(0, i).trim()] = v
  }
  return env
}

function str(v, max) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (!s) return null
  return s.slice(0, max)
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function fechaDia(v) {
  if (!v) return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10)
  }
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

/** No forzamos dato_medico_id: upsert por alumno_id (único). */
function adaptarFila(row) {
  return {
    alumno_id: Number(row.alumno_id),
    alumno_peso: str(row.alumno_peso, 30),
    alumno_estatura: str(row.alumno_estatura, 30),
    alumno_sangre_tipo: str(row.alumno_sangre_tipo, 30),
    alumno_alergia: str(row.alumno_alergia, 250),
    alumno_padecimiento: str(row.alumno_padecimiento, 200),
    alumno_medicina: str(row.alumno_medicina, 200),
    alumno_suministrar: str(row.alumno_suministrar, 200),
    alumno_medicamentos: str(row.alumno_medicamentos, 200),
    alumno_atencion_interna: numOrNull(row.alumno_atencion_interna),
    alumno_afiliacion: str(row.alumno_afiliacion, 50),
    alumno_afiliacion_externa: str(row.alumno_afiliacion_externa, 100),
    alumno_servicio_medico: numOrNull(row.alumno_servicio_medico),
    dato_medico_actualizacion: fechaDia(row.dato_medico_actualizacion),
  }
}

async function main() {
  const verifyOnly = process.argv.includes('--verify')
  const dryRun = process.argv.includes('--dry-run')
  const env = loadEnvLocal()
  const baseUrl = env.NEXT_PUBLIC_INSFORGE_URL ?? env.INSFORGE_URL
  const apiKey = env.INSFORGE_API_KEY
  if (!baseUrl || !apiKey) throw new Error('Faltan NEXT_PUBLIC_INSFORGE_URL e INSFORGE_API_KEY')

  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST,
    port: Number(env.MYSQL_PORT ?? 3306),
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE ?? 'winston_general',
  })

  const insforge = createAdminClient({ baseUrl, apiKey })

  const [rows] = await conn.query(
    'SELECT * FROM alumno_dato_medico WHERE alumno_id IS NOT NULL ORDER BY alumno_id ASC'
  )
  const filas = (rows ?? []).map(adaptarFila).filter((f) => Number.isFinite(f.alumno_id))
  console.log(`MySQL alumno_dato_medico: ${filas.length} filas`)

  const { count: ifCount, error: countErr } = await insforge.database
    .from('alumno_dato_medico')
    .select('*', { count: 'exact', head: true })
  if (countErr) throw new Error(`InsForge count: ${countErr.message}`)
  console.log(`InsForge alumno_dato_medico: ${ifCount ?? 0} filas`)

  if (verifyOnly) {
    await conn.end()
    const ok = (ifCount ?? 0) >= filas.length
    console.log(
      ok
        ? `✓ InsForge tiene al menos las ${filas.length} fichas de MySQL`
        : `✗ Faltan filas (InsForge ${ifCount ?? 0} < MySQL ${filas.length})`
    )
    process.exitCode = ok ? 0 : 1
    return
  }

  if (!filas.length) {
    console.log('Nada que migrar.')
    await conn.end()
    return
  }

  if (dryRun) {
    console.log(`Dry-run: se upsertarían ${filas.length} filas por alumno_id.`)
    console.log('Ejemplo:', filas[0])
    await conn.end()
    return
  }

  let upserted = 0
  let fallos = 0
  for (let i = 0; i < filas.length; i += BATCH) {
    const lote = filas.slice(i, i + BATCH)
    const { error } = await insforge.database
      .from('alumno_dato_medico')
      .upsert(lote, { onConflict: 'alumno_id' })
    if (error) {
      console.error(`\nError lote ${i}: ${error.message}`)
      // reintento fila a fila
      for (const fila of lote) {
        const { error: e1 } = await insforge.database
          .from('alumno_dato_medico')
          .upsert(fila, { onConflict: 'alumno_id' })
        if (e1) {
          fallos += 1
          console.error(`  alumno_id=${fila.alumno_id}: ${e1.message}`)
        } else {
          upserted += 1
        }
      }
    } else {
      upserted += lote.length
    }
    process.stdout.write(`\r  migrados: ${upserted}/${filas.length} (fallos ${fallos})`)
  }
  process.stdout.write('\n')

  const { count: after } = await insforge.database
    .from('alumno_dato_medico')
    .select('*', { count: 'exact', head: true })

  await conn.end()
  console.log(`✓ Migración completada: ${upserted} upserts, ${fallos} fallos.`)
  console.log(`  InsForge ahora: ${after ?? 0} filas`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
