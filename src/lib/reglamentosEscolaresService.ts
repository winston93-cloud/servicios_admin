import type { AppDatabaseClient, AppInsforgeClient } from '@/lib/dbTypes'
import { nivelReglamentoSlug } from '@/lib/portalAdmisionesConfig'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { appBaseUrl } from '@/lib/reportesConfig'

export const REGLAMENTOS_BUCKET = 'reglamentos-escolares'

export interface ReglamentoEscolarRegistro {
  id: number
  nivel: number
  ciclo_valor: number
  storage_key: string
  storage_url: string
  nombre_archivo: string | null
  updated_at: string
}

const SELECT =
  'id, nivel, ciclo_valor, storage_key, storage_url, nombre_archivo, updated_at'

export function storageKeyReglamento(nivel: number, cicloValor: number): string | null {
  const slug = nivelReglamentoSlug(nivel)
  if (!slug) return null
  return `reglamento_${slug}_${cicloValor}.pdf`
}

/** URL absoluta para abrir el PDF (proxy; bucket privado). */
export function hrefReglamentoArchivo(nivel: number, cicloValor: number): string {
  return `${appBaseUrl()}/api/reglamentos/archivo?nivel=${nivel}&ciclo=${cicloValor}`
}

export async function listarReglamentosPorCiclo(
  db: AppDatabaseClient,
  cicloValor: number
): Promise<ReglamentoEscolarRegistro[]> {
  const { data, error } = await db
    .from('reglamentos_escolares')
    .select(SELECT)
    .eq('ciclo_valor', cicloValor)
    .order('nivel', { ascending: true })

  if (error) throw error
  return (data ?? []) as ReglamentoEscolarRegistro[]
}

export async function obtenerReglamento(
  db: AppDatabaseClient,
  nivel: number,
  cicloValor: number
): Promise<ReglamentoEscolarRegistro | null> {
  const { data, error } = await db
    .from('reglamentos_escolares')
    .select(SELECT)
    .eq('nivel', nivel)
    .eq('ciclo_valor', cicloValor)
    .maybeSingle()

  if (error) throw error
  return (data as ReglamentoEscolarRegistro | null) ?? null
}

export async function guardarReglamentoPdf(
  client: AppInsforgeClient,
  opts: {
    nivel: number
    cicloValor: number
    buffer: Buffer
    nombreArchivo: string
  }
): Promise<ReglamentoEscolarRegistro> {
  const key = storageKeyReglamento(opts.nivel, opts.cicloValor)
  if (!key) {
    throw new Error(`Nivel inválido: ${opts.nivel}`)
  }

  const db = client.database
  const existente = await obtenerReglamento(db, opts.nivel, opts.cicloValor)

  if (existente?.storage_key && existente.storage_key !== key) {
    await client.storage.from(REGLAMENTOS_BUCKET).remove(existente.storage_key)
  }

  const blob = new Blob([opts.buffer], { type: 'application/pdf' })
  const { data: uploaded, error: upErr } = await client.storage
    .from(REGLAMENTOS_BUCKET)
    .upload(key, blob)

  if (upErr || !uploaded) {
    throw new Error(upErr?.message ?? 'No se pudo subir el PDF a storage')
  }

  const row = {
    nivel: opts.nivel,
    ciclo_valor: opts.cicloValor,
    storage_key: uploaded.key ?? key,
    storage_url: uploaded.url ?? '',
    nombre_archivo: opts.nombreArchivo,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await db
    .from('reglamentos_escolares')
    .upsert(row, { onConflict: 'nivel,ciclo_valor' })
    .select(SELECT)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'No se pudo guardar metadata del reglamento')
  }

  return data as ReglamentoEscolarRegistro
}

export async function eliminarReglamento(
  client: AppInsforgeClient,
  nivel: number,
  cicloValor: number
): Promise<void> {
  const db = client.database
  const existente = await obtenerReglamento(db, nivel, cicloValor)
  if (!existente) return

  if (existente.storage_key) {
    await client.storage.from(REGLAMENTOS_BUCKET).remove(existente.storage_key)
  }

  const { error } = await db
    .from('reglamentos_escolares')
    .delete()
    .eq('nivel', nivel)
    .eq('ciclo_valor', cicloValor)

  if (error) throw error
}

export function etiquetaReglamento(nivel: number, cicloValor: number): string {
  return `${etiquetaNivelEscolar(nivel)} · ciclo ${cicloValor}`
}
