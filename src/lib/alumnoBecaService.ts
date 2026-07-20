import { supabase } from './supabase'
import type { AppDatabaseClient } from '@/lib/dbTypes'
import { BECA_ESTATUS_ACTIVA } from './becaEstatus'

const SELECT_BECA =
  'alumno_beca_id, alumno_id, beca_id, beca_porcentaje, beca_estatus, beca_ciclo_escolar, beca_p'

export interface ConceptoBeca {
  beca_id: number
  beca_clase: string
}

export interface AlumnoBecaRegistro {
  alumno_beca_id: number
  alumno_id: number
  beca_id: number
  beca_porcentaje: number
  beca_estatus: number
  beca_ciclo_escolar: number
  beca_p: string
}

export async function listarConceptosBeca(): Promise<ConceptoBeca[]> {
  const { data, error } = await supabase
    .from('concepto_beca')
    .select('beca_id, beca_clase')
    .order('beca_id', { ascending: true })

  if (error) {
    console.error('Error al cargar concepto_beca:', error)
    return []
  }

  return (data ?? []) as ConceptoBeca[]
}

export async function obtenerBecaPorAlumnoId(
  alumnoId: number
): Promise<AlumnoBecaRegistro | null> {
  const { data, error } = await supabase
    .from('alumno_beca')
    .select(SELECT_BECA)
    .eq('alumno_id', alumnoId)
    .maybeSingle()

  if (error) {
    console.error('Error al cargar beca del alumno:', error)
    return null
  }

  return data as AlumnoBecaRegistro | null
}

/** Beca Winston activa al 100% en el ciclo indicado (no paga colegiaturas). */
export async function alumnoTieneBecaCompletaActiva(
  db: AppDatabaseClient,
  alumnoId: number,
  cicloEscolar: number
): Promise<boolean> {
  const { count, error } = await db
    .from('alumno_beca')
    .select('beca_id', { count: 'exact', head: true })
    .eq('alumno_id', alumnoId)
    .eq('beca_porcentaje', 100)
    .eq('beca_ciclo_escolar', cicloEscolar)
    .eq('beca_estatus', BECA_ESTATUS_ACTIVA)

  if (error) {
    console.error('alumnoTieneBecaCompletaActiva:', error.message)
    return false
  }
  return (count ?? 0) > 0
}

export interface GuardarBecaAlumnoPayload {
  alumnoBecaId: number | null
  alumnoId: number
  becaId: number
  porcentaje: number
  estatus: number
  cicloEscolar: number
  becaP?: string
}

export type ResultadoGuardarBeca =
  | { ok: true; alumnoBecaId: number }
  | { ok: false; mensaje: string }

export async function guardarBecaAlumno(
  payload: GuardarBecaAlumnoPayload
): Promise<ResultadoGuardarBeca> {
  const fila = {
    beca_id: payload.becaId,
    beca_porcentaje: Math.max(0, Math.min(100, Math.round(payload.porcentaje))),
    beca_estatus: payload.estatus,
    beca_ciclo_escolar: payload.cicloEscolar,
    beca_p: (payload.becaP ?? '0').trim() || '0',
  }

  // UPDATE si ya hay fila para este alumno_id; INSERT solo si no existe.
  let alumnoBecaId = payload.alumnoBecaId
  if (alumnoBecaId == null) {
    const existente = await obtenerBecaPorAlumnoId(payload.alumnoId)
    alumnoBecaId = existente?.alumno_beca_id ?? null
  }

  if (alumnoBecaId != null) {
    const { error } = await supabase
      .from('alumno_beca')
      .update(fila)
      .eq('alumno_beca_id', alumnoBecaId)
      .eq('alumno_id', payload.alumnoId)

    if (error) {
      console.error('Error al actualizar beca:', error)
      return { ok: false, mensaje: error.message }
    }

    return { ok: true, alumnoBecaId }
  }

  const { data, error } = await supabase
    .from('alumno_beca')
    .insert({
      alumno_id: payload.alumnoId,
      ...fila,
      beca_registro: new Date().toISOString(),
    })
    .select('alumno_beca_id')
    .single()

  if (error) {
    console.error('Error al crear beca:', error)
    return { ok: false, mensaje: error.message }
  }

  return { ok: true, alumnoBecaId: data.alumno_beca_id }
}
