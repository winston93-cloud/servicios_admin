import type { AppInsforgeClient } from '@/lib/dbTypes'
import { crearNombreArchivoFactura } from '@/lib/portalFacturaRutas'

export const CFDI_BUCKET = 'cfdi'

export type CfdiArchivosGuardados = {
  xmlKey: string | null
  pdfKey: string | null
  xmlUrl: string | null
  pdfUrl: string | null
}

function claveFactura(baseNombre: string, ext: 'xml' | 'pdf'): string {
  return `${baseNombre}.${ext}`
}

function objetosDeListado(data: unknown): { key?: string }[] {
  if (!data) return []
  if (Array.isArray(data)) return data as { key?: string }[]
  if (typeof data === 'object' && data !== null && 'data' in data) {
    const inner = (data as { data: unknown }).data
    if (Array.isArray(inner)) return inner as { key?: string }[]
  }
  if (typeof data === 'object' && data !== null && 'objects' in data) {
    const inner = (data as { objects: unknown }).objects
    if (Array.isArray(inner)) return inner as { key?: string }[]
  }
  return []
}

/**
 * InsForge renombra a `factura… (N).ext` si quedan variantes del mismo stem.
 * Hay que borrar canónico + ` (N)` antes de subir.
 */
async function purgarClavesFactura(
  client: AppInsforgeClient,
  baseNombre: string
): Promise<void> {
  const bucket = client.storage.from(CFDI_BUCKET)
  const { data, error } = await bucket.list({ prefix: baseNombre, limit: 100 })
  if (error) {
    console.error('cfdiStorage list:', error.message)
  }
  const keys = new Set<string>()
  for (const o of objetosDeListado(data)) {
    if (o.key) keys.add(o.key)
  }
  keys.add(claveFactura(baseNombre, 'pdf'))
  keys.add(claveFactura(baseNombre, 'xml'))
  for (const key of keys) {
    const rem = await bucket.remove(key)
    if (rem.error && !/not found/i.test(rem.error.message)) {
      console.error('cfdiStorage remove:', key, rem.error.message)
    }
  }
}

async function subirClaveExacta(
  client: AppInsforgeClient,
  key: string,
  blob: Blob
): Promise<{ key: string; url: string | null } | null> {
  const bucket = client.storage.from(CFDI_BUCKET)
  const { data, error } = await bucket.upload(key, blob)
  if (error) {
    console.error(`cfdiStorage upload ${key}:`, error.message)
    return null
  }
  const returned = data?.key ?? key
  if (returned === key) {
    return { key, url: data?.url ?? null }
  }
  // Backend renombró: forzar PUT al path canónico y borrar la variante.
  console.warn(`cfdiStorage: InsForge renombró ${key} → ${returned}; forzando clave canónica`)
  const baseUrl = (
    process.env.NEXT_PUBLIC_INSFORGE_URL ??
    process.env.INSFORGE_URL ??
    ''
  ).replace(/\/$/, '')
  const apiKey = process.env.INSFORGE_API_KEY
  if (!baseUrl || !apiKey) {
    console.error('cfdiStorage: no se puede forzar clave sin INSFORGE_URL/API_KEY')
    return { key: returned, url: data?.url ?? null }
  }
  try {
    const form = new FormData()
    form.append('file', blob, key)
    const put = await fetch(
      `${baseUrl}/api/storage/buckets/${CFDI_BUCKET}/objects/${encodeURIComponent(key)}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      }
    )
    if (!put.ok) {
      console.error('cfdiStorage PUT canónico:', put.status, await put.text())
      return { key: returned, url: data?.url ?? null }
    }
    const body = (await put.json()) as { key?: string; url?: string }
    await bucket.remove(returned)
    return { key: body.key ?? key, url: body.url ?? null }
  } catch (e) {
    console.error('cfdiStorage PUT canónico:', e instanceof Error ? e.message : e)
    return { key: returned, url: data?.url ?? null }
  }
}

/**
 * Persiste XML/PDF del PAC en InsForge Storage (bucket `cfdi`).
 * Naming legacy: factura{ref5}{concepto}{ciclo}.{xml|pdf}
 */
export async function guardarArchivosCfdi(
  client: AppInsforgeClient,
  opts: {
    alumnoRef: string | number
    conceptoNo: string
    ciclo: number
    xml?: string | null
    pdfBase64?: string | null
  }
): Promise<CfdiArchivosGuardados> {
  const base = crearNombreArchivoFactura(opts.alumnoRef, opts.conceptoNo, opts.ciclo)
  const vacio: CfdiArchivosGuardados = {
    xmlKey: null,
    pdfKey: null,
    xmlUrl: null,
    pdfUrl: null,
  }
  if (!base) return vacio

  await purgarClavesFactura(client, base)

  let xmlKey: string | null = null
  let pdfKey: string | null = null
  let xmlUrl: string | null = null
  let pdfUrl: string | null = null

  if (opts.xml?.trim()) {
    const key = claveFactura(base, 'xml')
    const blob = new Blob([opts.xml], { type: 'application/xml; charset=utf-8' })
    const saved = await subirClaveExacta(client, key, blob)
    if (saved) {
      xmlKey = saved.key
      xmlUrl = saved.url
    }
  }

  if (opts.pdfBase64?.trim()) {
    const key = claveFactura(base, 'pdf')
    try {
      const bin = Buffer.from(opts.pdfBase64.replace(/\s/g, ''), 'base64')
      const blob = new Blob([bin], { type: 'application/pdf' })
      const saved = await subirClaveExacta(client, key, blob)
      if (saved) {
        pdfKey = saved.key
        pdfUrl = saved.url
      }
    } catch (e) {
      console.error('cfdiStorage PDF decode:', e instanceof Error ? e.message : e)
    }
  }

  return { xmlKey, pdfKey, xmlUrl, pdfUrl }
}

export function urlPublicaObjetoCfdi(key: string | null | undefined): string | null {
  if (!key) return null
  const base = (
    process.env.NEXT_PUBLIC_INSFORGE_URL ??
    process.env.INSFORGE_URL ??
    ''
  ).replace(/\/$/, '')
  if (!base) return null
  return `${base}/api/storage/buckets/${CFDI_BUCKET}/objects/${encodeURIComponent(key)}`
}
