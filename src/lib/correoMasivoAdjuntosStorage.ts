import { createInsforgeAdmin } from '@/lib/insforgeAdmin'
import type { AdjuntoCorreo } from '@/lib/emailServicios'

export const CORREO_MASIVO_TEMP_BUCKET = 'correo-masivo-temp'

/** Máximo por archivo vía FormData a Vercel (~4 MB). */
export const CORREO_MASIVO_MAX_ARCHIVO_DIRECTO_BYTES = 3.5 * 1024 * 1024

/** Máximo por archivo vía subida directa a InsForge/S3 (sin pasar por Vercel). */
export const CORREO_MASIVO_MAX_ARCHIVO_GRANDE_BYTES = 12 * 1024 * 1024

/** Máximo total recomendado (Gmail ~25 MB por mensaje). */
export const CORREO_MASIVO_MAX_TOTAL_BYTES = 24 * 1024 * 1024

export type EstrategiaSubidaInsforge = {
  method: 'presigned' | 'direct'
  uploadUrl: string
  key: string
  fields?: Record<string, string>
  confirmRequired?: boolean
  confirmUrl?: string
}

export type AdjuntoTemporalMeta = {
  key: string
  filename: string
  contentType: string
  size: number
}

const TOKEN_RE = /^[0-9a-f-]{36}$/i

let bucketAsegurado: Promise<void> | null = null

function insforgeAdminEnv(): { baseUrl: string; apiKey: string } {
  const baseUrl = (
    process.env.NEXT_PUBLIC_INSFORGE_URL ??
    process.env.INSFORGE_URL ??
    ''
  ).replace(/\/$/, '')
  const apiKey = process.env.INSFORGE_API_KEY ?? ''
  if (!baseUrl || !apiKey) {
    throw new Error('InsForge no configurado (INSFORGE_URL / INSFORGE_API_KEY)')
  }
  return { baseUrl, apiKey }
}

/** Crea el bucket temporal si no existe (Vercel tiene la API key; el agente cloud no). */
export async function asegurarBucketCorreoMasivoTemp(): Promise<void> {
  if (!bucketAsegurado) {
    bucketAsegurado = (async () => {
      const { baseUrl, apiKey } = insforgeAdminEnv()
      const res = await fetch(`${baseUrl}/api/storage/buckets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          bucketName: CORREO_MASIVO_TEMP_BUCKET,
          isPublic: false,
        }),
      })
      if (res.ok || res.status === 409) return
      let msg = `No se pudo crear bucket ${CORREO_MASIVO_TEMP_BUCKET} (${res.status})`
      try {
        const json = (await res.json()) as { message?: string }
        if (json.message) msg = json.message
      } catch {
        /* ignore */
      }
      throw new Error(msg)
    })().catch((e) => {
      bucketAsegurado = null
      throw e
    })
  }
  await bucketAsegurado
}

export function esTokenAdjuntosValido(token: string): boolean {
  return TOKEN_RE.test(token.trim())
}

export function sanitizarNombreAdjunto(nombre: string): string {
  const base = String(nombre ?? 'archivo')
    .replace(/[/\\]/g, '_')
    .replace(/\.\./g, '_')
    .trim()
  return base.slice(0, 180) || 'archivo.pdf'
}

export function claveAdjuntoTemporal(token: string, filename: string): string {
  return `${token}/${sanitizarNombreAdjunto(filename)}`
}

export function esConfirmUrlAdjuntoValida(confirmUrl: string): boolean {
  const trimmed = confirmUrl.trim()
  return (
    trimmed.startsWith('/api/storage/buckets/correo-masivo-temp/') &&
    trimmed.includes('/confirm-upload')
  )
}

export async function obtenerEstrategiaSubidaAdjunto(
  token: string,
  filename: string,
  size: number,
  contentType: string
): Promise<{ token: string; key: string; strategy: EstrategiaSubidaInsforge }> {
  const effectiveToken = esTokenAdjuntosValido(token) ? token : crypto.randomUUID()
  if (!filename.trim()) throw new Error('Nombre de archivo inválido')
  if (!Number.isFinite(size) || size <= 0) throw new Error('Tamaño de archivo inválido')
  if (size > CORREO_MASIVO_MAX_ARCHIVO_GRANDE_BYTES) {
    throw new Error(
      `El archivo supera ~${(CORREO_MASIVO_MAX_ARCHIVO_GRANDE_BYTES / (1024 * 1024)).toFixed(0)} MB por adjunto`
    )
  }

  await asegurarBucketCorreoMasivoTemp()
  const key = claveAdjuntoTemporal(effectiveToken, filename)
  const { baseUrl, apiKey } = insforgeAdminEnv()
  const res = await fetch(
    `${baseUrl}/api/storage/buckets/${CORREO_MASIVO_TEMP_BUCKET}/upload-strategy`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        filename: key,
        contentType: contentType || 'application/octet-stream',
        size,
      }),
    }
  )
  if (!res.ok) {
    let msg = `No se pudo preparar subida (${res.status})`
    try {
      const json = (await res.json()) as { message?: string }
      if (json.message) msg = json.message
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  const raw = (await res.json()) as EstrategiaSubidaInsforge
  let uploadUrl = String(raw.uploadUrl ?? '')
  if (uploadUrl && !uploadUrl.startsWith('http')) {
    uploadUrl = `${baseUrl}${uploadUrl.startsWith('/') ? '' : '/'}${uploadUrl}`
  }
  return {
    token: effectiveToken,
    key,
    strategy: {
      ...raw,
      uploadUrl,
      key: raw.key ?? key,
    },
  }
}

export async function confirmarSubidaAdjuntoInsforge(
  confirmUrl: string,
  size: number,
  contentType: string
): Promise<void> {
  if (!esConfirmUrlAdjuntoValida(confirmUrl)) {
    throw new Error('URL de confirmación inválida')
  }
  const { baseUrl, apiKey } = insforgeAdminEnv()
  const res = await fetch(`${baseUrl}${confirmUrl}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      size,
      contentType: contentType || 'application/octet-stream',
    }),
  })
  if (!res.ok) {
    let msg = `Confirmación de subida falló (${res.status})`
    try {
      const json = (await res.json()) as { message?: string }
      if (json.message) msg = json.message
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
}

export async function subirAdjuntoTemporal(
  token: string,
  filename: string,
  buffer: Buffer,
  contentType?: string
): Promise<AdjuntoTemporalMeta> {
  if (!esTokenAdjuntosValido(token)) {
    throw new Error('Token de adjuntos inválido')
  }
  await asegurarBucketCorreoMasivoTemp()
  const key = claveAdjuntoTemporal(token, filename)
  const client = createInsforgeAdmin()
  const blob = new Blob([buffer], { type: contentType || 'application/octet-stream' })
  const { data, error } = await client.storage.from(CORREO_MASIVO_TEMP_BUCKET).upload(key, blob)
  if (error) throw new Error(error.message)
  return {
    key: data?.key ?? key,
    filename: sanitizarNombreAdjunto(filename),
    contentType: contentType || 'application/octet-stream',
    size: buffer.length,
  }
}

export async function listarAdjuntosTemporales(token: string): Promise<AdjuntoTemporalMeta[]> {
  if (!esTokenAdjuntosValido(token)) return []
  const client = createInsforgeAdmin()
  const { data, error } = await client.storage.from(CORREO_MASIVO_TEMP_BUCKET).list({
    prefix: `${token}/`,
    limit: 50,
  })
  if (error) throw new Error(error.message)
  const filas = Array.isArray(data) ? data : []
  const out: AdjuntoTemporalMeta[] = []
  for (const row of filas) {
    const key = String((row as { key?: string }).key ?? '')
    if (!key || key.endsWith('/')) continue
    const filename = key.slice(token.length + 1)
    out.push({
      key,
      filename,
      contentType: 'application/octet-stream',
      size: Number((row as { size?: number }).size ?? 0),
    })
  }
  return out.sort((a, b) => a.filename.localeCompare(b.filename, 'es'))
}

export async function descargarAdjuntosTemporales(
  token: string
): Promise<AdjuntoCorreo[]> {
  const metas = await listarAdjuntosTemporales(token)
  if (!metas.length) return []
  const client = createInsforgeAdmin()
  const bucket = client.storage.from(CORREO_MASIVO_TEMP_BUCKET)
  const out: AdjuntoCorreo[] = []
  for (const meta of metas) {
    const { data, error } = await bucket.download(meta.key)
    if (error || !data) throw new Error(`No se pudo leer adjunto ${meta.filename}`)
    const buf = Buffer.from(await data.arrayBuffer())
    out.push({
      filename: meta.filename,
      content: buf,
      contentType: meta.contentType !== 'application/octet-stream' ? meta.contentType : undefined,
    })
  }
  return out
}

export async function eliminarAdjuntosTemporales(token: string): Promise<void> {
  if (!esTokenAdjuntosValido(token)) return
  const metas = await listarAdjuntosTemporales(token)
  if (!metas.length) return
  const client = createInsforgeAdmin()
  const bucket = client.storage.from(CORREO_MASIVO_TEMP_BUCKET)
  for (const meta of metas) {
    const { error } = await bucket.remove(meta.key)
    if (error) console.error('eliminarAdjuntosTemporales:', meta.key, error.message)
  }
}
