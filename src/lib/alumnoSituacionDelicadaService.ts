import { supabase } from './supabase'

export const SITUACION_DELICADA_COMENTARIOS_MAX = 2000

export type AlumnoSituacionDelicadaRegistro = {
  situacion_id: number
  alumno_ref: number
  alumno_id: number
  no_corresponde: boolean
  comentarios: string
  actualizado_por: string | null
  created_at: string
  updated_at: string
}

export type SnapshotSituacionDelicada = {
  noCorresponde: boolean
  comentarios: string
}

export const SITUACION_DELICADA_VACIA: SnapshotSituacionDelicada = {
  noCorresponde: true,
  comentarios: '',
}

function textoComentarios(valor: string | null | undefined): string {
  return String(valor ?? '').trim()
}

/** `no_corresponde` en BD: true = No corresponde, false = Aplica. */
export function esNoCorresponde(value: unknown): boolean {
  if (value === false || value === 0) return false
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (v === 'false' || v === 'f' || v === '0' || v === 'no') return false
    if (v === 'true' || v === 't' || v === '1' || v === 'si' || v === 'sí' || v === 'yes') {
      return true
    }
  }
  if (value === true || value === 1) return true
  return true
}

export function snapshotGuardado(snapshot: SnapshotSituacionDelicada): SnapshotSituacionDelicada {
  return {
    noCorresponde: snapshot.noCorresponde,
    comentarios: snapshot.noCorresponde ? '' : textoComentarios(snapshot.comentarios),
  }
}

function numeroControl(valor: string | number | null | undefined): number | null {
  if (valor == null || valor === '') return null
  const n = typeof valor === 'number' ? valor : parseInt(String(valor).trim(), 10)
  return Number.isFinite(n) ? n : null
}

const SELECT_SITUACION =
  'situacion_id, alumno_ref, alumno_id, no_corresponde, comentarios, actualizado_por, created_at, updated_at'

export function snapshotDesdeRegistro(
  registro: AlumnoSituacionDelicadaRegistro | null
): SnapshotSituacionDelicada {
  if (!registro) return { ...SITUACION_DELICADA_VACIA }
  return {
    noCorresponde: esNoCorresponde(registro.no_corresponde),
    comentarios: textoComentarios(registro.comentarios),
  }
}

export function etiquetaSituacionDelicada(
  snapshot: SnapshotSituacionDelicada | null
): string {
  if (!snapshot || snapshot.noCorresponde) return 'No corresponde'
  return 'Aplica'
}

export function validarSituacionDelicada(
  snapshot: SnapshotSituacionDelicada
): string | null {
  if (snapshot.noCorresponde) return null
  if (!textoComentarios(snapshot.comentarios)) {
    return 'Añade un comentario cuando marques Aplica.'
  }
  if (textoComentarios(snapshot.comentarios).length > SITUACION_DELICADA_COMENTARIOS_MAX) {
    return `El comentario no puede pasar de ${SITUACION_DELICADA_COMENTARIOS_MAX} caracteres.`
  }
  return null
}

export async function obtenerSituacionDelicadaPorAlumnoId(
  alumnoId: number,
  alumnoRef?: string | number | null
): Promise<AlumnoSituacionDelicadaRegistro | null> {
  const ref = numeroControl(alumnoRef)
  let query = supabase.from('alumno_situacion_delicada').select(SELECT_SITUACION)

  if (ref != null) {
    query = query.eq('alumno_ref', ref)
  } else {
    query = query.eq('alumno_id', alumnoId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    console.error('Error al cargar situación delicada:', error)
    throw new Error(error.message)
  }

  return (data as AlumnoSituacionDelicadaRegistro | null) ?? null
}

export type GuardarSituacionDelicadaPayload = SnapshotSituacionDelicada & {
  alumnoRef: string | number
  alumnoId: number
  actualizadoPor?: string | null
}

export type ResultadoGuardarSituacionDelicada =
  | { ok: true; registro: AlumnoSituacionDelicadaRegistro }
  | { ok: false; mensaje: string }

export async function guardarSituacionDelicada(
  payload: GuardarSituacionDelicadaPayload
): Promise<ResultadoGuardarSituacionDelicada> {
  const errorValidacion = validarSituacionDelicada(payload)
  if (errorValidacion) return { ok: false, mensaje: errorValidacion }

  const comentarios = textoComentarios(payload.comentarios)
  const alumnoRef = numeroControl(payload.alumnoRef)
  if (alumnoRef == null) {
    return { ok: false, mensaje: 'Falta el número de control del alumno.' }
  }

  const { data, error } = await supabase
    .from('alumno_situacion_delicada')
    .upsert(
      [
        {
          alumno_ref: alumnoRef,
          alumno_id: payload.alumnoId,
          no_corresponde: payload.noCorresponde,
          comentarios,
          actualizado_por: payload.actualizadoPor?.trim() || null,
        },
      ],
      { onConflict: 'alumno_ref', ignoreDuplicates: false }
    )
    .select(SELECT_SITUACION)
    .single()

  if (error) {
    console.error('Error al guardar situación delicada:', error)
    return { ok: false, mensaje: error.message }
  }

  if (data) {
    return { ok: true, registro: data as AlumnoSituacionDelicadaRegistro }
  }

  try {
    const registro = await obtenerSituacionDelicadaPorAlumnoId(
      payload.alumnoId,
      alumnoRef
    )
    if (!registro) {
      return { ok: false, mensaje: 'Se guardó, pero no se pudo leer el registro.' }
    }
    return { ok: true, registro }
  } catch (err) {
    return {
      ok: false,
      mensaje: err instanceof Error ? err.message : 'No se pudo leer el registro guardado.',
    }
  }
}
