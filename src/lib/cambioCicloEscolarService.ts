import { supabase } from './supabase'
import {
  CICLO_CAMBIO_DESTINO,
  CICLO_CAMBIO_ORIGEN,
  calcularDestinoCambioCiclo,
} from './cambioCicloEscolarAdvance'

export interface AlumnoCambioCicloRow {
  alumno_id: number
  alumno_ref: string
  alumno_app: string
  alumno_apm: string
  alumno_nombre: string
  alumno_nivel: number
  alumno_grado: number
  alumno_grupo: number
  alumno_status: number
  alumno_nuevo_ingreso: number
  /** Tiene respaldo en BD: se puede regresar al ciclo origen. */
  puedeRevertir: boolean
}

const SELECT_ALUMNO =
  'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_status, alumno_nuevo_ingreso'

function mapFila(
  r: Record<string, unknown>,
  puedeRevertir = false
): AlumnoCambioCicloRow {
  return {
    alumno_id: Number(r.alumno_id),
    alumno_ref: String(r.alumno_ref ?? ''),
    alumno_app: String(r.alumno_app ?? ''),
    alumno_apm: String(r.alumno_apm ?? ''),
    alumno_nombre: String(r.alumno_nombre ?? ''),
    alumno_nivel: Number(r.alumno_nivel),
    alumno_grado: Number(r.alumno_grado),
    alumno_grupo: Number(r.alumno_grupo ?? 0),
    alumno_status: Number(r.alumno_status ?? 1),
    alumno_nuevo_ingreso: Number(r.alumno_nuevo_ingreso ?? 0),
    puedeRevertir,
  }
}

async function idsConRespaldo(alumnoIds: number[]): Promise<Set<number>> {
  if (alumnoIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('alumno_cambio_ciclo_respaldo')
    .select('alumno_id')
    .in('alumno_id', alumnoIds)

  if (error) {
    console.error('Consultar respaldo cambio ciclo:', error)
    return new Set()
  }
  return new Set((data ?? []).map((r) => Number(r.alumno_id)))
}

/** Alumnos activos en ciclo origen (22) por nivel y grado fuente. */
export async function listarAlumnosOrigenCambioCiclo(
  nivel: number,
  grado: number
): Promise<{ ok: true; filas: AlumnoCambioCicloRow[] } | { ok: false; mensaje: string }> {
  const { data, error } = await supabase
    .from('alumno')
    .select(SELECT_ALUMNO)
    .eq('alumno_ciclo_escolar', CICLO_CAMBIO_ORIGEN)
    .eq('alumno_nivel', nivel)
    .eq('alumno_grado', grado)
    .eq('alumno_status', 1)
    .order('alumno_app', { ascending: true })
    .order('alumno_apm', { ascending: true })
    .order('alumno_nombre', { ascending: true })

  if (error) {
    console.error('Listar origen cambio ciclo:', error)
    return { ok: false, mensaje: error.message }
  }

  const filas = (data ?? []).map((r) => mapFila(r as Record<string, unknown>))
  return { ok: true, filas }
}

/** Alumnos ya en ciclo destino (23) en el nivel/grado calculado desde la selección fuente. */
export async function listarAlumnosDestinoCambioCiclo(
  nivelOrigen: number,
  gradoOrigen: number
): Promise<{ ok: true; filas: AlumnoCambioCicloRow[] } | { ok: false; mensaje: string }> {
  const dest = calcularDestinoCambioCiclo(nivelOrigen, gradoOrigen)

  let query = supabase
    .from('alumno')
    .select(SELECT_ALUMNO)
    .eq('alumno_ciclo_escolar', CICLO_CAMBIO_DESTINO)
    .eq('alumno_nivel', dest.nivel)
    .eq('alumno_grado', dest.grado)

  if (dest.egresa) {
    query = query.in('alumno_status', [0, 1])
  } else {
    query = query.eq('alumno_status', 1)
  }

  const { data, error } = await query
    .order('alumno_app', { ascending: true })
    .order('alumno_apm', { ascending: true })
    .order('alumno_nombre', { ascending: true })

  if (error) {
    console.error('Listar destino cambio ciclo:', error)
    return { ok: false, mensaje: error.message }
  }

  const ids = (data ?? []).map((r) => Number(r.alumno_id))
  const reversibles = await idsConRespaldo(ids)

  const filas = (data ?? []).map((r) =>
    mapFila(r as Record<string, unknown>, reversibles.has(Number(r.alumno_id)))
  )
  return { ok: true, filas }
}

interface RespaldoRow {
  alumno_id: number
  alumno_ciclo_escolar: number
  alumno_nivel: number
  alumno_grado: number
  alumno_grupo: number
  alumno_nuevo_ingreso: number
  alumno_status: number
  ciclo_destino: number
  nivel_destino: number
  grado_destino: number
}

async function guardarRespaldo(
  alumno: AlumnoCambioCicloRow,
  dest: ReturnType<typeof calcularDestinoCambioCiclo>
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const payload: RespaldoRow = {
    alumno_id: alumno.alumno_id,
    alumno_ciclo_escolar: CICLO_CAMBIO_ORIGEN,
    alumno_nivel: alumno.alumno_nivel,
    alumno_grado: alumno.alumno_grado,
    alumno_grupo: alumno.alumno_grupo,
    alumno_nuevo_ingreso: alumno.alumno_nuevo_ingreso,
    alumno_status: alumno.alumno_status,
    ciclo_destino: CICLO_CAMBIO_DESTINO,
    nivel_destino: dest.nivel,
    grado_destino: dest.grado,
  }

  const { error } = await supabase
    .from('alumno_cambio_ciclo_respaldo')
    .upsert(payload, { onConflict: 'alumno_id' })

  if (error) {
    console.error('Guardar respaldo cambio ciclo:', error)
    const hint =
      error.message.includes('does not exist') || error.message.includes('relation')
        ? ' Ejecuta la migración SQL `alumno_cambio_ciclo_respaldo` en InsForge.'
        : ''
    return { ok: false, mensaje: error.message + hint }
  }
  return { ok: true }
}

async function migrarUnAlumno(
  alumno: AlumnoCambioCicloRow,
  nivelOrigen: number,
  gradoOrigen: number
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const dest = calcularDestinoCambioCiclo(nivelOrigen, gradoOrigen)

  const respaldo = await guardarRespaldo(alumno, dest)
  if (!respaldo.ok) return respaldo

  const payload: Record<string, number> = {
    alumno_ciclo_escolar: CICLO_CAMBIO_DESTINO,
    alumno_nivel: dest.nivel,
    alumno_grado: dest.grado,
    alumno_grupo: 1,
  }

  if (alumno.alumno_nuevo_ingreso === 1) {
    payload.alumno_nuevo_ingreso = 0
  }

  if (dest.egresa) {
    payload.alumno_grado = 4
    payload.alumno_status = 0
  }

  const { error } = await supabase
    .from('alumno')
    .update(payload)
    .eq('alumno_id', alumno.alumno_id)
    .eq('alumno_ciclo_escolar', CICLO_CAMBIO_ORIGEN)

  if (error) {
    console.error('Migrar alumno cambio ciclo:', error)
    return { ok: false, mensaje: error.message }
  }
  return { ok: true }
}

export async function migrarAlumnosCambioCiclo(
  alumnoIds: number[],
  nivelOrigen: number,
  gradoOrigen: number
): Promise<
  | { ok: true; migrados: number }
  | { ok: false; mensaje: string; migrados: number }
> {
  if (alumnoIds.length === 0) {
    return { ok: false, mensaje: 'No hay alumnos seleccionados.', migrados: 0 }
  }

  const { data, error } = await supabase
    .from('alumno')
    .select(SELECT_ALUMNO)
    .in('alumno_id', alumnoIds)
    .eq('alumno_ciclo_escolar', CICLO_CAMBIO_ORIGEN)
    .eq('alumno_nivel', nivelOrigen)
    .eq('alumno_grado', gradoOrigen)
    .eq('alumno_status', 1)

  if (error) {
    return { ok: false, mensaje: error.message, migrados: 0 }
  }

  const alumnos = (data ?? []).map((r) => mapFila(r as Record<string, unknown>))
  let migrados = 0

  for (const alumno of alumnos) {
    const res = await migrarUnAlumno(alumno, nivelOrigen, gradoOrigen)
    if (!res.ok) {
      return { ok: false, mensaje: res.mensaje, migrados }
    }
    migrados += 1
  }

  return { ok: true, migrados }
}

export async function revertirAlumnosCambioCiclo(
  alumnoIds: number[]
): Promise<
  | { ok: true; revertidos: number }
  | { ok: false; mensaje: string; revertidos: number }
> {
  if (alumnoIds.length === 0) {
    return { ok: false, mensaje: 'No hay alumnos seleccionados.', revertidos: 0 }
  }

  const { data: respaldos, error: errRespaldo } = await supabase
    .from('alumno_cambio_ciclo_respaldo')
    .select('*')
    .in('alumno_id', alumnoIds)

  if (errRespaldo) {
    return { ok: false, mensaje: errRespaldo.message, revertidos: 0 }
  }

  const filas = respaldos ?? []
  if (filas.length === 0) {
    return {
      ok: false,
      mensaje: 'Ninguno de los seleccionados tiene respaldo de migración.',
      revertidos: 0,
    }
  }

  let revertidos = 0
  for (const r of filas) {
    const { error } = await supabase
      .from('alumno')
      .update({
        alumno_ciclo_escolar: Number(r.alumno_ciclo_escolar),
        alumno_nivel: Number(r.alumno_nivel),
        alumno_grado: Number(r.alumno_grado),
        alumno_grupo: Number(r.alumno_grupo),
        alumno_nuevo_ingreso: Number(r.alumno_nuevo_ingreso),
        alumno_status: Number(r.alumno_status),
      })
      .eq('alumno_id', Number(r.alumno_id))
      .eq('alumno_ciclo_escolar', CICLO_CAMBIO_DESTINO)

    if (error) {
      return { ok: false, mensaje: error.message, revertidos }
    }

    const { error: errDel } = await supabase
      .from('alumno_cambio_ciclo_respaldo')
      .delete()
      .eq('alumno_id', Number(r.alumno_id))

    if (errDel) {
      return { ok: false, mensaje: errDel.message, revertidos }
    }
    revertidos += 1
  }

  return { ok: true, revertidos }
}
