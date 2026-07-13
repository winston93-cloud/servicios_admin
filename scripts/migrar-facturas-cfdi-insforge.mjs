#!/usr/bin/env node
/**
 * Migra facturas PDF/XML del hosting Banorte → InsForge Storage (bucket `cfdi`).
 *
 * Lista pagos facturados en MySQL (winston_general) por rango de fecha, descarga
 * desde https://www.winston93.edu.mx/banorte/facturas/ y sube con el mismo nombre.
 *
 * Uso (desde servicios_admin, con MYSQL_* + INSFORGE_* en .env.local):
 *
 *   node scripts/migrar-facturas-cfdi-insforge.mjs --dry-run
 *   node scripts/migrar-facturas-cfdi-insforge.mjs --limit=50
 *   node scripts/migrar-facturas-cfdi-insforge.mjs
 *   node scripts/migrar-facturas-cfdi-insforge.mjs --from=2026-01-01 --to=2026-07-13
 *
 * Reanudable: lee/escribe scripts/.cache/migrar-facturas-cfdi-manifest.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { createAdminClient } from '@insforge/sdk'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = path.join(ROOT, 'scripts/.cache/migrar-facturas-cfdi-manifest.json')
const BUCKET = 'cfdi'
const HOSTING_BASE = 'https://www.winston93.edu.mx/banorte/facturas'
const CONCURRENCY = 4

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

function parseArgs(argv) {
  const out = {
    dryRun: false,
    from: '2026-01-01',
    to: '2026-07-13',
    limit: 0,
  }
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true
    else if (a.startsWith('--from=')) out.from = a.slice(7)
    else if (a.startsWith('--to=')) out.to = a.slice(5)
    else if (a.startsWith('--limit=')) out.limit = Number(a.slice(8)) || 0
  }
  return out
}

/** factura{ref5}{concepto2}{ciclo2} desde pago_referencia (12 dígitos). */
function nombreArchivoDesdeRef(ref) {
  const d = String(ref ?? '').replace(/\D/g, '')
  if (d.length < 9) return null
  return `factura${d.slice(0, 7)}${d.slice(7, 9)}`
}

function loadManifest() {
  try {
    if (!fs.existsSync(MANIFEST)) return { done: {}, failed: {} }
    return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  } catch {
    return { done: {}, failed: {} }
  }
}

function saveManifest(m) {
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true })
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2))
}

async function mapPool(items, concurrency, fn) {
  const results = []
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
}

async function fetchHosting(fileName) {
  const url = `${HOSTING_BASE}/${fileName}`
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) {
    return { ok: false, status: res.status, buffer: null, contentType: null }
  }
  const ab = await res.arrayBuffer()
  return {
    ok: true,
    status: res.status,
    buffer: Buffer.from(ab),
    contentType: res.headers.get('content-type') || undefined,
  }
}

async function objectExists(client, key) {
  try {
    const { data, error } = await client.storage.from(BUCKET).download(key)
    if (error || !data) return false
    return true
  } catch {
    return false
  }
}

async function uploadFile(client, key, buffer, contentType) {
  const blob = new Blob([buffer], { type: contentType || 'application/octet-stream' })
  const { data, error } = await client.storage.from(BUCKET).upload(key, blob)
  if (error) throw new Error(error.message)
  return data
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const env = loadEnvLocal()
  const baseUrl = env.NEXT_PUBLIC_INSFORGE_URL ?? env.INSFORGE_URL
  const apiKey = env.INSFORGE_API_KEY
  if (!baseUrl || !apiKey) throw new Error('Faltan NEXT_PUBLIC_INSFORGE_URL e INSFORGE_API_KEY')

  console.log(
    JSON.stringify({
      from: args.from,
      to: args.to,
      dryRun: args.dryRun,
      limit: args.limit || null,
      bucket: BUCKET,
      hosting: HOSTING_BASE,
    })
  )

  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST,
    port: Number(env.MYSQL_PORT ?? 3306),
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE ?? 'winston_general',
  })

  const [rows] = await conn.query(
    `
    SELECT DISTINCT pago_referencia
    FROM pago_detalle
    WHERE pago_fecha >= ? AND pago_fecha <= ?
      AND IFNULL(pago_cancelado, 0) <> 3
      AND UPPER(TRIM(IFNULL(facturo, ''))) = 'SI'
      AND CHAR_LENGTH(pago_referencia) >= 9
    ORDER BY pago_referencia
    `,
    [args.from, args.to]
  )
  await conn.end()

  const stems = new Set()
  for (const r of rows) {
    const n = nombreArchivoDesdeRef(r.pago_referencia)
    if (n) stems.add(n)
  }
  let list = [...stems].sort()
  if (args.limit > 0) list = list.slice(0, args.limit)

  console.log(`referencias_facturadas=${rows.length} archivos_unicos=${stems.size} a_procesar=${list.length}`)

  if (args.dryRun) {
    const sample = list.slice(0, 8)
    const heads = []
    for (const stem of sample) {
      for (const ext of ['pdf', 'xml']) {
        const file = `${stem}.${ext}`
        try {
          const res = await fetch(`${HOSTING_BASE}/${file}`, { method: 'HEAD', redirect: 'follow' })
          heads.push({ file, status: res.status })
        } catch (e) {
          heads.push({ file, status: 0, err: e instanceof Error ? e.message : String(e) })
        }
      }
    }
    console.log('dry_run_sample_head', JSON.stringify(heads, null, 2))
    console.log('dry_run_ok')
    return
  }

  const client = createAdminClient({ baseUrl, apiKey })
  const manifest = loadManifest()
  let uploaded = 0
  let skipped = 0
  let failed = 0
  let missingHost = 0

  await mapPool(list, CONCURRENCY, async (stem) => {
    for (const ext of ['pdf', 'xml']) {
      const file = `${stem}.${ext}`
      if (manifest.done[file]) {
        skipped++
        continue
      }
      try {
        if (await objectExists(client, file)) {
          manifest.done[file] = { at: new Date().toISOString(), skip: 'exists' }
          skipped++
          continue
        }
        const remote = await fetchHosting(file)
        if (!remote.ok || !remote.buffer) {
          missingHost++
          manifest.failed[file] = {
            at: new Date().toISOString(),
            status: remote.status,
            reason: 'host_missing',
          }
          failed++
          continue
        }
        const ctype = ext === 'pdf' ? 'application/pdf' : 'application/xml; charset=utf-8'
        await uploadFile(client, file, remote.buffer, ctype)
        manifest.done[file] = {
          at: new Date().toISOString(),
          bytes: remote.buffer.length,
        }
        delete manifest.failed[file]
        uploaded++
        if ((uploaded + skipped) % 25 === 0) {
          saveManifest(manifest)
          console.log(
            `progress uploaded=${uploaded} skipped=${skipped} failed=${failed} missingHost=${missingHost}`
          )
        }
      } catch (e) {
        failed++
        manifest.failed[file] = {
          at: new Date().toISOString(),
          reason: e instanceof Error ? e.message : String(e),
        }
        console.warn('fail', file, manifest.failed[file].reason)
      }
    }
  })

  saveManifest(manifest)
  console.log(
    JSON.stringify({
      done: true,
      uploaded,
      skipped,
      failed,
      missingHost,
      manifestDone: Object.keys(manifest.done).length,
      manifestFailed: Object.keys(manifest.failed).length,
      manifestPath: MANIFEST,
    })
  )
}

main().catch((e) => {
  console.error('ERR', e instanceof Error ? e.message : e)
  process.exit(1)
})
