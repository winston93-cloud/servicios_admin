#!/usr/bin/env node
/**
 * Copia facturas que aún están en hosting y faltan en InsForge Storage.
 *
 * Origen: índice de https://www.winston93.edu.mx/banorte/facturas/
 * Destino: bucket InsForge `cfdi`
 *
 *   node scripts/completar-facturas-hosting-insforge.mjs --dry-run
 *   node scripts/completar-facturas-hosting-insforge.mjs
 *   node scripts/completar-facturas-hosting-insforge.mjs --limit=20
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAdminClient } from '@insforge/sdk'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HOSTING = 'https://www.winston93.edu.mx/banorte/facturas'
const BUCKET = 'cfdi'
const PAUSE_MS = 700
const MANIFEST = path.join(ROOT, 'scripts/.cache/completar-facturas-hosting-manifest.json')
const PRIOR_MANIFESTS = [
  path.join(ROOT, 'scripts/.cache/migrar-facturas-cfdi-manifest.json'),
  path.join(ROOT, 'scripts/.cache/migrar-facturas-cfdi-2025-manifest.json'),
]

function loadEnv() {
  const env = { ...process.env }
  const p = path.join(ROOT, '.env.local')
  if (!fs.existsSync(p)) return env
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const i = t.indexOf('=')
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[t.slice(0, i).trim()] = v
  }
  return env
}

function parseArgs(argv) {
  const out = { dryRun: false, limit: 0 }
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true
    else if (a.startsWith('--limit=')) out.limit = Number(a.slice(8)) || 0
  }
  return out
}

function loadDoneKeys() {
  const done = new Set()
  for (const p of [...PRIOR_MANIFESTS, MANIFEST]) {
    if (!fs.existsSync(p)) continue
    try {
      const m = JSON.parse(fs.readFileSync(p, 'utf8'))
      for (const k of Object.keys(m.done || {})) done.add(k)
    } catch {
      /* ignore */
    }
  }
  return done
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function listHostingFiles() {
  const res = await fetch(`${HOSTING}/`)
  if (!res.ok) throw new Error(`No se pudo listar hosting: HTTP ${res.status}`)
  const html = await res.text()
  return [
    ...new Set(
      [...html.matchAll(/href="(factura[^"]+\.(?:pdf|xml))"/gi)].map((m) =>
        decodeURIComponent(m[1])
      )
    ),
  ].sort()
}

async function storageExists(baseUrl, apiKey, key) {
  const res = await fetch(
    `${baseUrl}/api/storage/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`,
    { method: 'HEAD', headers: { Authorization: `Bearer ${apiKey}` } }
  )
  return res.ok
}

async function uploadWithRetry(client, key, buffer, contentType) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const blob = new Blob([buffer], { type: contentType })
      const { error } = await client.storage.from(BUCKET).upload(key, blob)
      if (error) throw new Error(error.message)
      return
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/already exists|duplicate|conflict|409/i.test(msg)) return
      const retriable =
        /429|Too Many|Gateway|ECONN|ETIMEDOUT|fetch failed|Size is required/i.test(msg)
      if (!retriable || attempt === 7) throw e instanceof Error ? e : new Error(msg)
      const wait = Math.min(90_000, 2000 * 2 ** attempt)
      console.warn(`backoff ${key} #${attempt + 1} ${wait}ms :: ${msg}`)
      await sleep(wait)
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const env = loadEnv()
  const baseUrl = env.NEXT_PUBLIC_INSFORGE_URL || env.INSFORGE_URL
  const apiKey = env.INSFORGE_API_KEY
  if (!baseUrl || !apiKey) throw new Error('Faltan NEXT_PUBLIC_INSFORGE_URL / INSFORGE_API_KEY')

  const client = createAdminClient({ baseUrl, apiKey })
  const hostFiles = await listHostingFiles()
  const doneKeys = loadDoneKeys()
  let pending = hostFiles.filter((f) => !doneKeys.has(f))
  console.log(
    JSON.stringify({
      hostingFiles: hostFiles.length,
      alreadyInManifests: hostFiles.length - pending.length,
      pendingManifest: pending.length,
      dryRun: args.dryRun,
    })
  )

  const need = []
  for (let i = 0; i < pending.length; i++) {
    const f = pending[i]
    if (!(await storageExists(baseUrl, apiKey, f))) need.push(f)
    if ((i + 1) % 200 === 0) {
      console.log(`storage-check ${i + 1}/${pending.length} need=${need.length}`)
    }
    if ((i + 1) % 40 === 0) await sleep(100)
  }
  if (args.limit > 0) need.splice(args.limit)
  console.log(`faltan_en_insforge_hay_en_hosting=${need.length}`)

  if (args.dryRun) {
    console.log(JSON.stringify({ dryRun: true, need: need.length, sample: need.slice(0, 15) }))
    return
  }

  const manifest = fs.existsSync(MANIFEST)
    ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
    : { done: {}, failed: {} }
  manifest.done ||= {}
  manifest.failed ||= {}

  let uploaded = 0
  let failed = 0
  for (let i = 0; i < need.length; i++) {
    const file = need[i]
    try {
      const res = await fetch(`${HOSTING}/${file}`, { redirect: 'follow' })
      if (!res.ok) {
        manifest.failed[file] = {
          at: new Date().toISOString(),
          status: res.status,
          reason: 'host_fetch_failed',
        }
        failed++
        continue
      }
      const buf = Buffer.from(await res.arrayBuffer())
      if (!buf.length) {
        manifest.failed[file] = { at: new Date().toISOString(), reason: 'empty' }
        failed++
        continue
      }
      const ctype = file.endsWith('.pdf')
        ? 'application/pdf'
        : 'application/xml; charset=utf-8'
      await uploadWithRetry(client, file, buf, ctype)
      await sleep(PAUSE_MS)
      manifest.done[file] = { at: new Date().toISOString(), bytes: buf.length }
      delete manifest.failed[file]
      uploaded++
      if (uploaded % 10 === 0) {
        fs.mkdirSync(path.dirname(MANIFEST), { recursive: true })
        fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2))
        console.log(
          `progress ${i + 1}/${need.length} uploaded=${uploaded} failed=${failed}`
        )
      }
    } catch (e) {
      failed++
      const reason = e instanceof Error ? e.message : String(e)
      manifest.failed[file] = { at: new Date().toISOString(), reason }
      console.warn('fail', file, reason)
      if (/429|Too Many/i.test(reason)) await sleep(20_000)
    }
  }

  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true })
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2))
  console.log(
    JSON.stringify({
      done: true,
      uploaded,
      failed,
      need: need.length,
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
