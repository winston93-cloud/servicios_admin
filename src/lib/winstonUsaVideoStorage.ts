import { createInsforgeAdmin } from '@/lib/insforgeAdmin'
import type { EstrategiaSubidaInsforge } from '@/lib/correoMasivoAdjuntosStorage'

/** Bucket público: solo el video de marketing del programa (visible para cualquier papá). */
export const USA_VIDEO_BUCKET = 'winston-usa-video'

export const USA_VIDEO_MAX_BYTES = 500 * 1024 * 1024

const EXTENSIONES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-m4v': 'm4v',
}

function insforgeEnv(): { baseUrl: string; apiKey: string } {
  const baseUrl = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? process.env.INSFORGE_URL ?? '').replace(/\/$/, '')
  const apiKey = process.env.INSFORGE_API_KEY ?? ''
  if (!baseUrl || !apiKey) throw new Error('InsForge no configurado (INSFORGE_URL / INSFORGE_API_KEY)')
  return { baseUrl, apiKey }
}

async function mensajeError(res: Response, base: string): Promise<string> {
  try {
    const json = (await res.json()) as { message?: string }
    if (json.message) return json.message
  } catch {
    /* ignore */
  }
  return `${base} (${res.status})`
}

let bucketAsegurado: Promise<void> | null = null

async function asegurarBucketVideoUsa(): Promise<void> {
  if (!bucketAsegurado) {
    bucketAsegurado = (async () => {
      const { baseUrl, apiKey } = insforgeEnv()
      const res = await fetch(`${baseUrl}/api/storage/buckets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ bucketName: USA_VIDEO_BUCKET, isPublic: true }),
      })
      if (res.ok || res.status === 409) return
      throw new Error(await mensajeError(res, `No se pudo crear bucket ${USA_VIDEO_BUCKET}`))
    })().catch((e) => {
      bucketAsegurado = null
      throw e
    })
  }
  await bucketAsegurado
}

export function extensionVideoUsa(contentType: string, filename: string): string | null {
  const porTipo = EXTENSIONES[contentType.toLowerCase()]
  if (porTipo) return porTipo
  const ext = filename.toLowerCase().match(/\.(mp4|webm|mov|m4v)$/)?.[1]
  return ext ?? null
}

export function urlPublicaVideoUsa(key: string): string {
  const { baseUrl } = insforgeEnv()
  return `${baseUrl}/api/storage/buckets/${USA_VIDEO_BUCKET}/objects/${encodeURIComponent(key)}`
}

/** Key del bucket si la URL es un video subido aquí; null si es YouTube/Drive/etc. */
export function keyDeUrlVideoUsa(url: string | null | undefined): string | null {
  if (!url) return null
  const marca = `/api/storage/buckets/${USA_VIDEO_BUCKET}/objects/`
  const i = url.indexOf(marca)
  if (i < 0) return null
  try {
    return decodeURIComponent(url.slice(i + marca.length).split('?')[0])
  } catch {
    return null
  }
}

export function esKeyVideoUsaDelCiclo(key: string, ciclo: number): boolean {
  return new RegExp(`^ciclo-${ciclo}/[0-9a-f-]{36}\\.(mp4|webm|mov|m4v)$`, 'i').test(key)
}

export async function prepararSubidaVideoUsa(
  ciclo: number,
  filename: string,
  size: number,
  contentType: string
): Promise<{ key: string; strategy: EstrategiaSubidaInsforge }> {
  const ext = extensionVideoUsa(contentType, filename)
  if (!ext) throw new Error('Formato no permitido: sube un video MP4, MOV o WebM.')
  if (!Number.isFinite(size) || size <= 0) throw new Error('Tamaño de archivo inválido')
  if (size > USA_VIDEO_MAX_BYTES) {
    throw new Error(`El video supera ${USA_VIDEO_MAX_BYTES / (1024 * 1024)} MB. Comprímelo antes de subirlo.`)
  }
  await asegurarBucketVideoUsa()
  const key = `ciclo-${ciclo}/${crypto.randomUUID()}.${ext}`
  const { baseUrl, apiKey } = insforgeEnv()
  const res = await fetch(`${baseUrl}/api/storage/buckets/${USA_VIDEO_BUCKET}/upload-strategy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ filename: key, contentType: contentType || 'video/mp4', size }),
  })
  if (!res.ok) throw new Error(await mensajeError(res, 'No se pudo preparar la subida'))
  const raw = (await res.json()) as EstrategiaSubidaInsforge
  let uploadUrl = String(raw.uploadUrl ?? '')
  if (uploadUrl && !uploadUrl.startsWith('http')) {
    uploadUrl = `${baseUrl}${uploadUrl.startsWith('/') ? '' : '/'}${uploadUrl}`
  }
  return { key: raw.key ?? key, strategy: { ...raw, uploadUrl, key: raw.key ?? key } }
}

export async function confirmarSubidaVideoUsa(
  confirmUrl: string,
  size: number,
  contentType: string
): Promise<void> {
  const url = confirmUrl.trim()
  if (!url.startsWith(`/api/storage/buckets/${USA_VIDEO_BUCKET}/`) || !url.includes('/confirm-upload')) {
    throw new Error('URL de confirmación inválida')
  }
  const { baseUrl, apiKey } = insforgeEnv()
  const res = await fetch(`${baseUrl}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ size, contentType: contentType || 'video/mp4' }),
  })
  if (!res.ok) throw new Error(await mensajeError(res, 'No se pudo confirmar la subida'))
}

export async function eliminarVideoUsa(key: string): Promise<void> {
  const { error } = await createInsforgeAdmin().storage.from(USA_VIDEO_BUCKET).remove(key)
  if (error) console.warn('eliminarVideoUsa:', key, error.message)
}
