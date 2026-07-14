#!/usr/bin/env node
/**
 * Migra facturas PDF/XML del hosting Banorte → InsForge Storage (bucket `cfdi`).
 * Origen solo para la copia inicial; el portal ya no usa hosting en runtime.
 *
 *   node scripts/migrar-facturas-cfdi-insforge.mjs --dry-run
 *   node scripts/migrar-facturas-cfdi-insforge.mjs --limit=50
 *   node scripts/migrar-facturas-cfdi-insforge.mjs
 *
 * Reanudable: scripts/.cache/migrar-facturas-cfdi-manifest.json
 * Los fallos por rate-limit se reintentan; host_missing se conserva.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { createAdminClient } from '@insforge/sdk'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_MANIFEST = path.join(ROOT, 'scripts/.cache/migrar-facturas-cfdi-manifest.json')
const BUCKET = 'cfdi'
const HOSTING_BASE = 'https://www.winston93.edu.mx/banorte/facturas'
/** InsForge rate-limit: 1 worker + pausa fija + backoff 429. */
const CONCURRENCY = 1
const PAUSE_MS = 900
const MAX_RETRIES = 8

/** Ruta activa del manifiesto (se fija en main vía --manifest). */
let MANIFEST = DEFAULT_MANIFEST

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
    keepRateFails: false,
    manifest: DEFAULT_MANIFEST,
  }
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--keep-rate-fails') out.keepRateFails = true
    else if (a.startsWith('--from=')) out.from = a.slice(7)
    else if (a.startsWith('--to=')) out.to = a.slice(5)
    else if (a.startsWith('--limit=')) out.limit = Number(a.slice(8)) || 0
    else if (a.startsWith('--manifest=')) {
      const p = a.slice(11).trim()
      out.manifest = path.isAbsolute(p) ? p : path.join(ROOT, p)
    }
  }
  return out
}

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

function isRetriableFail(entry) {
  if (!entry) return false
  if (entry.reason === 'host_missing') return false
  const r = String(entry.reason ?? '')
  return (
    /Too Many Requests/i.test(r) ||
    /429/.test(r) ||
    /Gateway Time-?out/i.test(r) ||
    /ECONNRESET|ETIMEDOUT|fetch failed/i.test(r)
  )
}

function clearRetriableFails(manifest) {
  let cleared = 0
  for (const [k, v] of Object.entries(manifest.failed || {})) {
    if (isRetriableFail(v)) {
      delete manifest.failed[k]
      cleared++
    }
  }
  return cleared
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
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
  const n = Math.min(concurrency, Math.max(items.length, 1))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return results
}

async function fetchHosting(fileName) {
  const url = `${HOSTING_BASE}/${fileName}`
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) {
    return { ok: false, status: res.status, buffer: null }
  }
  const ab = await res.arrayBuffer()
  return { ok: true, status: res.status, buffer: Buffer.from(ab) }
}

async function uploadWithRetry(client, key, buffer, contentType) {
  let lastErr = null
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const blob = new Blob([buffer], { type: contentType || 'application/octet-stream' })
      const { data, error } = await client.storage.from(BUCKET).upload(key, blob)
      if (error) throw new Error(error.message)
      return data
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      const msg = lastErr.message
      const retriable =
        /Too Many Requests/i.test(msg) ||
        /429/.test(msg) ||
        /Gateway Time-?out/i.test(msg) ||
        /ECONNRESET|ETIMEDOUT|fetch failed/i.test(msg)
      if (!retriable || attempt === MAX_RETRIES - 1) throw lastErr
      const wait = Math.min(90_000, 2000 * 2 ** attempt)
      console.warn(`backoff ${key} attempt=${attempt + 1} waitMs=${wait} :: ${msg}`)
      await sleep(wait)
    }
  }
  throw lastErr ?? new Error('upload failed')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  MANIFEST = args.manifest
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
      concurrency: CONCURRENCY,
      pauseMs: PAUSE_MS,
      sourceCopy: HOSTING_BASE,
      manifest: MANIFEST,
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

  console.log(
    `referencias_facturadas=${rows.length} archivos_unicos=${stems.size} a_procesar=${list.length}`
  )

  if (args.dryRun) {
    console.log('dry_run_ok sample=', list.slice(0, 5))
    return
  }

  const client = createAdminClient({ baseUrl, apiKey })
  const manifest = loadManifest()
  if (!args.keepRateFails) {
    const cleared = clearRetriableFails(manifest)
    if (cleared) {
      saveManifest(manifest)
      console.log(`cleared_retriable_fails=${cleared}`)
    }
  }

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
      if (manifest.failed[file]?.reason === 'host_missing') {
        missingHost++
        failed++
        continue
      }
      try {
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
        await uploadWithRetry(client, file, remote.buffer, ctype)
        await sleep(PAUSE_MS)
        manifest.done[file] = {
          at: new Date().toISOString(),
          bytes: remote.buffer.length,
        }
        delete manifest.failed[file]
        uploaded++
        if ((uploaded + skipped) % 10 === 0) {
          saveManifest(manifest)
          console.log(
            `progress uploaded=${uploaded} skipped=${skipped} failed=${failed} missingHost=${missingHost} doneTotal=${Object.keys(manifest.done).length}`
          )
        }
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e)
        if (/already exists|duplicate|conflict|409/i.test(reason)) {
          manifest.done[file] = { at: new Date().toISOString(), skip: 'exists' }
          delete manifest.failed[file]
          skipped++
          continue
        }
        failed++
        manifest.failed[file] = { at: new Date().toISOString(), reason }
        console.warn('fail', file, reason)
        if (/Too Many Requests|429/i.test(reason)) {
          await sleep(20_000)
        }
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
