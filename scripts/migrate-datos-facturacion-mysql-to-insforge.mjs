#!/usr/bin/env node
/**
 * Migra datos_facturacion: MySQL winston_general → InsForge Winston Servicios.
 *
 * Requiere: .env.local con MYSQL_* e INSFORGE_API_KEY / NEXT_PUBLIC_INSFORGE_URL
 *
 *   node scripts/migrate-datos-facturacion-mysql-to-insforge.mjs
 *   node scripts/migrate-datos-facturacion-mysql-to-insforge.mjs --verify
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { createAdminClient } from '@insforge/sdk'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BATCH = 100

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

function adaptarFila(row) {
  const str = (v, max) => {
    if (v === null || v === undefined) return ''
    return String(v).trim().slice(0, max)
  }
  const req = (v, max) => str(v, max) || ' '
  return {
    id: Number(row.id),
    moneda: str(row.moneda, 5) || 'MXN',
    rfc: req(row.rfc, 15).toUpperCase(),
    razsocial: req(row.razsocial, 75),
    regfiscal: req(row.regfiscal, 5),
    usocfdi: req(row.usocfdi, 5).toUpperCase(),
    codpostal: req(row.codpostal, 5),
    calle: req(row.calle, 35),
    nexterior: str(row.nexterior, 8) || ' ',
    ninterior: str(row.ninterior, 10) || ' ',
    ncolonia: req(row.ncolonia, 50),
    nmunicipio: req(row.nmunicipio, 35),
    nentidad: req(row.nentidad, 45),
    email: req(row.email, 45),
    lada: str(row.lada, 15) || ' ',
    numero: str(row.numero, 15).replace(/\s/g, '') || ' ',
    alumno_ref: Number(row.alumno_ref),
  }
}

async function main() {
  const verifyOnly = process.argv.includes('--verify')
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

  const [rows] = await conn.query('SELECT * FROM datos_facturacion ORDER BY id ASC')
  const filas = (rows ?? []).map(adaptarFila)
  console.log(`MySQL datos_facturacion: ${filas.length} filas`)

  const { count: ifCount, error: countErr } = await insforge.database
    .from('datos_facturacion')
    .select('*', { count: 'exact', head: true })
  if (countErr) throw new Error(`InsForge count: ${countErr.message}`)
  console.log(`InsForge datos_facturacion: ${ifCount ?? 0} filas`)

  if (verifyOnly) {
    await conn.end()
    const ok = (ifCount ?? 0) === filas.length
    console.log(ok ? '✓ Conteos coinciden' : '✗ Conteos distintos')
    process.exitCode = ok ? 0 : 1
    return
  }

  if (!filas.length) {
    console.log('Nada que migrar.')
    await conn.end()
    return
  }

  let insertados = 0
  for (let i = 0; i < filas.length; i += BATCH) {
    const lote = filas.slice(i, i + BATCH)
    const { error } = await insforge.database
      .from('datos_facturacion')
      .upsert(lote, { onConflict: 'alumno_ref' })
    if (error) throw new Error(`Upsert lote ${i}: ${error.message}`)
    insertados += lote.length
    process.stdout.write(`\r  migrados: ${insertados}/${filas.length}`)
  }
  process.stdout.write('\n')

  await conn.end()
  console.log(`✓ Migración completada (${insertados} filas)`)
  console.log('  Tip: ajusta la secuencia id en InsForge si insertaste ids explícitos.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
