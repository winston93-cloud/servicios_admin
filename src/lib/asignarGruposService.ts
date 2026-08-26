import { supabase } from './supabase'

export interface AlumnoAsignacionGrupoRow {
  alumno_id: number
  alumno_ref: string
  alumno_app: string
  alumno_apm: string
  alumno_nombre: string
  alumno_nivel: number
  alumno_grado: number
  alumno_grupo: number
  alumno_status: number
}

export interface FiltrosAsignarGrupos {
  nivel: number
  grado: number
  grupo: number
  cicloEscolar: number
  /** Si > 0, asigna ese grupo a todo el grado antes de listar (como «Refill» legacy). */
  refillGrupo?: number
}

const SELECT_LISTA =
  'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_status'

/** Solo activos (`alumno_status = 1`) del ciclo. */
const ESTATUS_ACTIVO = 1

/** Asigna `refillGrupo` a todos los alumnos activos del nivel+grado+ciclo. */
export async function rellenarGrupoEnGrado(
  nivel: number,
  grado: number,
  cicloEscolar: number,
  refillGrupo: number
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const { error } = await supabase
    .from('alumno')
    .update({ alumno_grupo: refillGrupo })
    .eq('alumno_nivel', nivel)
    .eq('alumno_grado', grado)
    .eq('alumno_ciclo_escolar', cicloEscolar)
    .eq('alumno_status', ESTATUS_ACTIVO)

  if (error) {
    console.error('Refill grupo:', error)
    return { ok: false, mensaje: error.message }
  }
  return { ok: true }
}

export async function listarAlumnosParaAsignarGrupos(
  filtros: FiltrosAsignarGrupos
): Promise<{ ok: true; filas: AlumnoAsignacionGrupoRow[] } | { ok: false; mensaje: string }> {
  const { nivel, grado, grupo, cicloEscolar, refillGrupo } = filtros

  if (refillGrupo != null && refillGrupo > 0) {
    const refill = await rellenarGrupoEnGrado(nivel, grado, cicloEscolar, refillGrupo)
    if (!refill.ok) return refill
  }

  const { data, error } = await supabase
    .from('alumno')
    .select(SELECT_LISTA)
    .eq('alumno_nivel', nivel)
    .eq('alumno_grado', grado)
    .eq('alumno_grupo', grupo)
    .eq('alumno_ciclo_escolar', cicloEscolar)
    .eq('alumno_status', ESTATUS_ACTIVO)
    .order('alumno_app', { ascending: true })
    .order('alumno_apm', { ascending: true })
    .order('alumno_nombre', { ascending: true })

  if (error) {
    console.error('Listar alumnos asignar grupos:', error)
    return { ok: false, mensaje: error.message }
  }

  const filas = (data ?? []).map((r) => ({
    alumno_id: r.alumno_id,
    alumno_ref: String(r.alumno_ref ?? ''),
    alumno_app: r.alumno_app ?? '',
    alumno_apm: r.alumno_apm ?? '',
    alumno_nombre: r.alumno_nombre ?? '',
    alumno_nivel: Number(r.alumno_nivel),
    alumno_grado: Number(r.alumno_grado),
    alumno_grupo: Number(r.alumno_grupo ?? 0),
    alumno_status: Number(r.alumno_status ?? 1),
  }))

  return { ok: true, filas }
}

export interface ActualizacionAsignacionAlumno {
  alumnoId: number
  grado?: number
  grupo?: number
  status?: number
}

export async function actualizarAsignacionAlumno(
  cambio: ActualizacionAsignacionAlumno
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const payload: Record<string, number> = {}
  if (cambio.grado !== undefined) payload.alumno_grado = cambio.grado
  if (cambio.grupo !== undefined) payload.alumno_grupo = cambio.grupo
  if (cambio.status !== undefined) payload.alumno_status = cambio.status

  if (Object.keys(payload).length === 0) return { ok: true }

  const { error } = await supabase
    .from('alumno')
    .update(payload)
    .eq('alumno_id', cambio.alumnoId)

  if (error) {
    console.error('Actualizar asignación alumno:', error)
    return { ok: false, mensaje: error.message }
  }
  return { ok: true }
}

export async function guardarAsignacionesAlumnos(
  cambios: ActualizacionAsignacionAlumno[]
): Promise<{ ok: true; guardados: number } | { ok: false; mensaje: string; guardados: number }> {
  let guardados = 0
  for (const c of cambios) {
    const res = await actualizarAsignacionAlumno(c)
    if (!res.ok) {
      return { ok: false, mensaje: res.mensaje, guardados }
    }
    guardados += 1
  }
  return { ok: true, guardados }
}
