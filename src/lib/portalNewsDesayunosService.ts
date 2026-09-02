import type { AppDatabaseClient, AppInsforgeClient } from '@/lib/dbTypes'
import { appBaseUrl } from '@/lib/reportesConfig'
import {
  AUDIENCIA_DESAYUNOS,
  type AudienciaNews,
  parseAudienciaNews,
} from './portalNewsDesayunosAudiencia'
import { clavePeriodo } from './portalNewsDesayunosMes'

export const NEWS_DESAYUNOS_BUCKET = 'portal-news-desayunos'

export type TipoPublicacionNewsDesayunos = 'news' | 'desayunos'

export interface PublicacionNewsDesayunos {
  id: number
  tipo: TipoPublicacionNewsDesayunos
  audiencia: string
  anio: number
  mes: number
  storage_key: string
  storage_url: string
  nombre_archivo: string | null
  mime_type: string
  creado_por: string | null
  created_at: string
  updated_at: string
}

const SELECT =
  'id, tipo, audiencia, anio, mes, storage_key, storage_url, nombre_archivo, mime_type, creado_por, created_at, updated_at'

const MIME_PERMITIDOS = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
])

export function audienciaParaTipo(
  tipo: TipoPublicacionNewsDesayunos,
  audiencia?: string | null
): string {
  if (tipo === 'desayunos') return AUDIENCIA_DESAYUNOS
  const parsed = parseAudienciaNews(audiencia)
  if (!parsed) {
    throw new Error('audiencia requerida: educativo, primaria o secundaria.')
  }
  return parsed
}

export function extensionDesdeMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    default:
      return 'pdf'
  }
}

export function storageKeyPublicacion(
  tipo: TipoPublicacionNewsDesayunos,
  anio: number,
  mes: number,
  mime: string,
  audiencia?: string | null
): string {
  const ext = extensionDesdeMime(mime)
  const periodo = clavePeriodo(anio, mes)
  const aud = String(audiencia ?? '')
  if (tipo === 'news') {
    return `news/${aud}/${periodo}.${ext}`
  }
  return `${tipo}/${periodo}.${ext}`
}

export function hrefPublicacionArchivo(
  tipo: TipoPublicacionNewsDesayunos,
  anio: number,
  mes: number,
  audiencia?: string | null
): string {
  const aud = tipo === 'desayunos' ? AUDIENCIA_DESAYUNOS : String(audiencia ?? '')
  const params = new URLSearchParams({
    tipo,
    anio: String(anio),
    mes: String(mes),
  })
  if (tipo === 'news' && aud) {
    params.set('audiencia', aud)
  }
  return `${appBaseUrl()}/api/portal-news-desayunos/archivo?${params.toString()}`
}

export function validarMimeArchivo(mime: string, nombre: string): string | null {
  const m = mime.trim().toLowerCase() || inferirMime(nombre)
  if (!MIME_PERMITIDOS.has(m)) return null
  if (m === 'image/jpg') return 'image/jpeg'
  return m
}

function inferirMime(nombre: string): string {
  const n = nombre.toLowerCase()
  if (n.endsWith('.png')) return 'image/png'
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg'
  if (n.endsWith('.webp')) return 'image/webp'
  return 'application/pdf'
}

export async function listarPublicaciones(
  db: AppDatabaseClient,
  opts?: { anio?: number; mes?: number; tipo?: TipoPublicacionNewsDesayunos; audiencia?: string }
): Promise<PublicacionNewsDesayunos[]> {
  let q = db.from('portal_news_desayunos').select(SELECT)
  if (opts?.anio) q = q.eq('anio', opts.anio)
  if (opts?.mes) q = q.eq('mes', opts.mes)
  if (opts?.tipo) q = q.eq('tipo', opts.tipo)
  if (opts?.audiencia != null) q = q.eq('audiencia', opts.audiencia)
  const { data, error } = await q
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })
    .order('tipo', { ascending: true })
    .order('audiencia', { ascending: true })

  if (error) throw error
  return (data ?? []) as PublicacionNewsDesayunos[]
}

export async function obtenerPublicacion(
  db: AppDatabaseClient,
  tipo: TipoPublicacionNewsDesayunos,
  anio: number,
  mes: number,
  audiencia?: string | null
): Promise<PublicacionNewsDesayunos | null> {
  const aud = audienciaParaTipo(tipo, audiencia)
  const { data, error } = await db
    .from('portal_news_desayunos')
    .select(SELECT)
    .eq('tipo', tipo)
    .eq('audiencia', aud)
    .eq('anio', anio)
    .eq('mes', mes)
    .maybeSingle()

  if (error) throw error
  return (data as PublicacionNewsDesayunos | null) ?? null
}

export async function guardarPublicacionArchivo(
  client: AppInsforgeClient,
  opts: {
    tipo: TipoPublicacionNewsDesayunos
    anio: number
    mes: number
    buffer: Buffer
    nombreArchivo: string
    mimeType: string
    creadoPor?: string
    audiencia?: string | null
  }
): Promise<PublicacionNewsDesayunos> {
  const mime = validarMimeArchivo(opts.mimeType, opts.nombreArchivo)
  if (!mime) {
    throw new Error('Formato no permitido. Use PDF, PNG, JPG o WEBP.')
  }

  const audiencia = audienciaParaTipo(opts.tipo, opts.audiencia)
  const key = storageKeyPublicacion(opts.tipo, opts.anio, opts.mes, mime, audiencia)
  const db = client.database
  const existente = await obtenerPublicacion(db, opts.tipo, opts.anio, opts.mes, audiencia)

  if (existente?.storage_key && existente.storage_key !== key) {
    await client.storage.from(NEWS_DESAYUNOS_BUCKET).remove(existente.storage_key)
  }

  const blob = new Blob([opts.buffer], { type: mime })
  const { data: uploaded, error: upErr } = await client.storage
    .from(NEWS_DESAYUNOS_BUCKET)
    .upload(key, blob)

  if (upErr || !uploaded) {
    throw new Error(upErr?.message ?? 'No se pudo subir el archivo a InsForge Storage.')
  }

  const row = {
    tipo: opts.tipo,
    audiencia,
    anio: opts.anio,
    mes: opts.mes,
    storage_key: uploaded.key ?? key,
    storage_url: uploaded.url ?? '',
    nombre_archivo: opts.nombreArchivo,
    mime_type: mime,
    creado_por: opts.creadoPor ?? null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await db
    .from('portal_news_desayunos')
    .upsert(row, { onConflict: 'tipo,audiencia,anio,mes' })
    .select(SELECT)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'No se pudo guardar la publicación.')
  }

  return data as PublicacionNewsDesayunos
}

export async function eliminarPublicacion(
  client: AppInsforgeClient,
  tipo: TipoPublicacionNewsDesayunos,
  anio: number,
  mes: number,
  audiencia?: string | null
): Promise<void> {
  const db = client.database
  const aud = audienciaParaTipo(tipo, audiencia)
  const existente = await obtenerPublicacion(db, tipo, anio, mes, aud)
  if (!existente) return

  if (existente.storage_key) {
    await client.storage.from(NEWS_DESAYUNOS_BUCKET).remove(existente.storage_key)
  }

  const { error } = await db
    .from('portal_news_desayunos')
    .delete()
    .eq('tipo', tipo)
    .eq('audiencia', aud)
    .eq('anio', anio)
    .eq('mes', mes)

  if (error) throw error
}

export function mapPublicacionRespuesta(p: PublicacionNewsDesayunos) {
  return {
    ...p,
    href: hrefPublicacionArchivo(p.tipo, p.anio, p.mes, p.audiencia),
    esImagen: p.mime_type.startsWith('image/'),
  }
}

export async function obtenerNewsParaAlumno(
  db: AppDatabaseClient,
  anio: number,
  mes: number,
  audiencia: AudienciaNews
): Promise<PublicacionNewsDesayunos | null> {
  return obtenerPublicacion(db, 'news', anio, mes, audiencia)
}
