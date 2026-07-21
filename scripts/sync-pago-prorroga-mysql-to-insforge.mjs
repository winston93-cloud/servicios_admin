#!/usr/bin/env node
/**
 * Sincroniza pago_prorroga: MySQL winston_general → InsForge Winston Servicios.
 * Remapea alumno_id por alumno_ref (los ids internos no coinciden).
 *
 *   node scripts/sync-pago-prorroga-mysql-to-insforge.mjs
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
    if (i < 0) continue
    let v = t.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    env[t.slice(0, i).trim()] = v
  }
  return env
}

function isoDate(v) {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v)
  return s.slice(0, 10)
}

function isoTs(v) {
  if (v == null) return new Date().toISOString()
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

async function main() {
  const env = loadEnvLocal()
  const baseUrl = env.NEXT_PUBLIC_INSFORGE_URL || env.INSFORGE_URL
  const apiKey = env.INSFORGE_API_KEY
  if (!baseUrl || !apiKey) throw new Error('Faltan credenciales InsForge')

  const mysqlConn = await mysql.createConnection({
    host: env.MYSQL_HOST,
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE || 'winston_general',
  })

  const admin = createAdminClient({ baseUrl, apiKey })
  const db = admin.database

  console.log('Cargando mapa alumno_ref → alumno_id (InsForge)…')
  const refToId = new Map()
  let from = 0
  for (;;) {
    const { data, error } = await db
      .from('alumno')
      .select('alumno_id, alumno_ref')
      .not('alumno_ref', 'is', null)
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    for (const r of data) {
      if (r.alumno_ref != null) refToId.set(Number(r.alumno_ref), Number(r.alumno_id))
    }
    if (data.length < 1000) break
    from += 1000
  }
  console.log(`  refs mapeadas: ${refToId.size}`)

  const [rows] = await mysqlConn.query(
    `SELECT porroga_id, alumno_id, alumno_ref, pago_concepto, pago_importe,
            prorroga_fecha, prorroga_status, prorroga_ciclo_escolar, prorroga_no,
            correccion, autor, prorroga_registro
     FROM pago_prorroga
     ORDER BY porroga_id ASC`
  )
  console.log(`MySQL filas: ${rows.length}`)

  let ok = 0
  let skip = 0
  let fail = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const payload = []
    for (const r of chunk) {
      const ref = Number(r.alumno_ref)
      const alumnoId = refToId.get(ref)
      if (!alumnoId) {
        skip++
        continue
      }
      payload.push({
        prorroga_id: Number(r.porroga_id),
        alumno_id: alumnoId,
        alumno_ref: ref,
        pago_concepto: Number(r.pago_concepto),
        pago_importe: Number(r.pago_importe),
        prorroga_fecha: isoDate(r.prorroga_fecha),
        prorroga_status: Number(r.prorroga_status ?? 1),
        prorroga_ciclo_escolar: Number(r.prorroga_ciclo_escolar),
        prorroga_no: Number(r.prorroga_no ?? 1),
        correccion: Number(r.correccion ?? 0),
        autor: String(r.autor ?? '').slice(0, 50),
        prorroga_registro: isoTs(r.prorroga_registro),
      })
    }

    if (!payload.length) continue

    const { error } = await db.from('pago_prorroga').upsert(payload, {
      onConflict: 'prorroga_id',
    })
    if (error) {
      console.error(`Batch ${i}:`, error.message)
      fail += payload.length
    } else {
      ok += payload.length
    }
    process.stdout.write(`\r  upsert ${Math.min(i + BATCH, rows.length)}/${rows.length}`)
  }

  console.log(`\nOK=${ok} skip_sin_alumno=${skip} fail=${fail}`)

  const { data: check } = await db
    .from('pago_prorroga')
    .select('prorroga_id', { count: 'exact', head: true })
  console.log('InsForge count head:', check)

  await mysqlConn.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
