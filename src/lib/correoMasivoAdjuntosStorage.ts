import { createInsforgeAdmin } from '@/lib/insforgeAdmin'
import type { AdjuntoCorreo } from '@/lib/emailServicios'

export const CORREO_MASIVO_TEMP_BUCKET = 'correo-masivo-temp'

/** Máximo por archivo en una petición directa a Vercel (~4.5 MB). */
export const CORREO_MASIVO_MAX_ARCHIVO_DIRECTO_BYTES = 3.5 * 1024 * 1024

/** Máximo total recomendado (Gmail ~25 MB por mensaje). */
export const CORREO_MASIVO_MAX_TOTAL_BYTES = 24 * 1024 * 1024

export type AdjuntoTemporalMeta = {
  key: string
  filename: string
  contentType: string
  size: number
}

const TOKEN_RE = /^[0-9a-f-]{36}$/i

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

export async function subirAdjuntoTemporal(
  token: string,
  filename: string,
  buffer: Buffer,
  contentType?: string
): Promise<AdjuntoTemporalMeta> {
  if (!esTokenAdjuntosValido(token)) {
    throw new Error('Token de adjuntos inválido')
  }
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
