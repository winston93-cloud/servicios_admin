import type { AppDatabaseClient } from './dbTypes'
import { supabase } from './supabase'

export const CASO_ESPECIAL_MOTIVO_MAX = 500
export const CASO_ESPECIAL_NOMBRE_MAX = 160

export type AlumnoCasoEspecialRegistro = {
  caso_id: number
  alumno_ref: number
  alumno_id: number
  fecha: string
  persona_nombre: string
  parentesco: string
  telefono: string
  motivo: string
  contacto_id: number | null
  creado_por: string | null
  created_at: string
  updated_at: string
}

export type SnapshotCasoEspecial = {
  fecha: string
  personaNombre: string
  parentesco: string
  telefono: string
  motivo: string
  contactoId: number | null
}

const SELECT_CASO =
  'caso_id, alumno_ref, alumno_id, fecha, persona_nombre, parentesco, telefono, motivo, contacto_id, creado_por, created_at, updated_at'

export function hoyMexicoIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

function texto(valor: unknown, max: number): string {
  return String(valor ?? '')
    .trim()
    .slice(0, max)
}

function fechaIso(valor: unknown): string | null {
  const raw = String(valor ?? '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  return raw
}

export function validarCasoEspecial(
  snapshot: SnapshotCasoEspecial,
  opts?: { permitirFechaPasada?: boolean }
): string | null {
  const fecha = fechaIso(snapshot.fecha)
  if (!fecha) return 'Indica la fecha del caso especial.'
  if (!opts?.permitirFechaPasada && fecha < hoyMexicoIso()) {
    return 'La fecha del caso especial no puede ser anterior a hoy.'
  }
  if (!texto(snapshot.personaNombre, CASO_ESPECIAL_NOMBRE_MAX)) {
    return 'Indica quién recogerá al alumno ese día.'
  }
  return null
}

export async function listarCasosEspeciales(
  alumnoId: number,
  db: AppDatabaseClient = supabase
): Promise<AlumnoCasoEspecialRegistro[]> {
  const { data, error } = await db
    .from('alumno_caso_especial')
    .select(SELECT_CASO)
    .eq('alumno_id', alumnoId)
    .order('fecha', { ascending: false })
    .order('caso_id', { ascending: false })
    .limit(80)

  if (error) {
    console.error('Error al listar casos especiales:', error)
    throw new Error(error.message)
  }

  return (data ?? []) as AlumnoCasoEspecialRegistro[]
}

export type GuardarCasoEspecialPayload = SnapshotCasoEspecial & {
  alumnoRef: number
  alumnoId: number
  creadoPor?: string | null
}

export type ResultadoGuardarCasoEspecial =
  | { ok: true; registro: AlumnoCasoEspecialRegistro }
  | { ok: false; mensaje: string }

export async function guardarCasoEspecial(
  payload: GuardarCasoEspecialPayload,
  db: AppDatabaseClient = supabase
): Promise<ResultadoGuardarCasoEspecial> {
  const snapshot: SnapshotCasoEspecial = {
    fecha: payload.fecha,
    personaNombre: payload.personaNombre,
    parentesco: payload.parentesco,
    telefono: payload.telefono,
    motivo: payload.motivo,
    contactoId: payload.contactoId,
  }
  const errorValidacion = validarCasoEspecial(snapshot)
  if (errorValidacion) return { ok: false, mensaje: errorValidacion }

  const fila = {
    alumno_ref: payload.alumnoRef,
    alumno_id: payload.alumnoId,
    fecha: fechaIso(payload.fecha),
    persona_nombre: texto(payload.personaNombre, CASO_ESPECIAL_NOMBRE_MAX),
    parentesco: texto(payload.parentesco, 80),
    telefono: texto(payload.telefono, 40),
    motivo: texto(payload.motivo, CASO_ESPECIAL_MOTIVO_MAX),
    contacto_id:
      payload.contactoId != null && Number.isFinite(payload.contactoId) && payload.contactoId > 0
        ? payload.contactoId
        : null,
    creado_por: texto(payload.creadoPor, 160) || null,
  }

  const { data, error } = await db
    .from('alumno_caso_especial')
    .insert([fila])
    .select(SELECT_CASO)
    .single()

  if (error || !data) {
    console.error('Error al guardar caso especial:', error)
    return { ok: false, mensaje: error?.message ?? 'No se pudo guardar el caso especial.' }
  }

  return { ok: true, registro: data as AlumnoCasoEspecialRegistro }
}

export async function eliminarCasoEspecial(
  alumnoId: number,
  casoId: number,
  db: AppDatabaseClient = supabase
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const { error } = await db
    .from('alumno_caso_especial')
    .delete()
    .eq('caso_id', casoId)
    .eq('alumno_id', alumnoId)

  if (error) {
    console.error('Error al eliminar caso especial:', error)
    return { ok: false, mensaje: error.message }
  }

  return { ok: true }
}
