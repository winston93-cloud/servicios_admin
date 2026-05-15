import { normalizarCurp } from './curp'
import { supabase } from './supabase'
import { sexoAlumnoPorDefecto } from './alumnoSexo'

export interface AlumnoRegistro {
  alumno_id: number
  alumno_ref: string
  alumno_nombre: string
  alumno_app: string
  alumno_apm: string
  alumno_nivel: number
  alumno_grado?: string | number | null
  alumno_grupo?: string | number | null
  alumno_status?: number | null
  alumno_ciclo_escolar?: string | number | null
  alumno_registro?: string | null
  alumno_alta?: string | null
  alumno_nuevo_ingreso?: number | null
}

const SELECT_ALUMNO =
  'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, alumno_status, alumno_ciclo_escolar, alumno_registro, alumno_alta, alumno_nuevo_ingreso'

function cicloNumerico(ciclo: string | number | null | undefined): number {
  if (ciclo == null || ciclo === '') return 0
  const n = typeof ciclo === 'number' ? ciclo : parseInt(String(ciclo), 10)
  return Number.isNaN(n) ? 0 : n
}

/** Registro vigente por número de control (ciclo escolar más reciente, cualquier estatus). */
export async function obtenerAlumnoPorRef(alumnoRef: string): Promise<AlumnoRegistro | null> {
  const ref = String(alumnoRef ?? '').trim()
  if (!ref) return null

  const refFiltro = /^\d+$/.test(ref) ? parseInt(ref, 10) : ref

  const { data, error } = await supabase
    .from('alumno')
    .select(SELECT_ALUMNO)
    .eq('alumno_ref', refFiltro)
    .order('alumno_ciclo_escolar', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error al cargar alumno por ref:', error)
    return null
  }

  return data as AlumnoRegistro | null
}

export async function obtenerAlumnoPorId(alumnoId: number): Promise<AlumnoRegistro | null> {
  const { data, error } = await supabase
    .from('alumno')
    .select(SELECT_ALUMNO)
    .eq('alumno_id', alumnoId)
    .maybeSingle()

  if (error) {
    console.error('Error al cargar alumno:', error)
    return null
  }

  return data as AlumnoRegistro | null
}

export interface AlumnoDetallesRegistro {
  detalle_id: number
  alumno_id: number
  alumno_clave?: string | null
  alumno_curp?: string | null
  alumno_fecha_nac?: string | null
  alumno_sexo?: string | null
}

export async function obtenerAlumnoDetallesPorAlumnoId(
  alumnoId: number
): Promise<AlumnoDetallesRegistro | null> {
  const { data, error } = await supabase
    .from('alumno_detalles')
    .select('detalle_id, alumno_id, alumno_clave, alumno_curp, alumno_fecha_nac, alumno_sexo')
    .eq('alumno_id', alumnoId)
    .order('detalle_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error al cargar detalles del alumno:', error)
    return null
  }

  return data as AlumnoDetallesRegistro | null
}

export interface AlumnoDatosElementales {
  alumno: AlumnoRegistro
  detalles: AlumnoDetallesRegistro | null
}

export async function obtenerDatosElementalesAlumno(
  alumnoId: number
): Promise<AlumnoDatosElementales | null> {
  const alumno = await obtenerAlumnoPorId(alumnoId)
  if (!alumno) return null
  const detalles = await obtenerAlumnoDetallesPorAlumnoId(alumno.alumno_id)
  return { alumno, detalles }
}

/** Carga por no. de control para alinear alumno_id con la tabla alumno. */
export async function obtenerDatosElementalesPorRef(
  alumnoRef: string
): Promise<AlumnoDatosElementales | null> {
  const alumno = await obtenerAlumnoPorRef(alumnoRef)
  if (!alumno) return null
  const detalles = await obtenerAlumnoDetallesPorAlumnoId(alumno.alumno_id)
  return { alumno, detalles }
}

/** Valores editables del formulario elementales para detectar cambios. */
export interface SnapshotDatosElementales {
  apellidoPaterno: string
  apellidoMaterno: string
  nombre: string
  clavePersonal: string
  cicloEscolar: number
  nivelEscolar: number
  gradoEscolar: number
  grupoEscolar: number
  curp: string
  fechaNacimientoIso: string
  fechaAltaIso: string
  formaIngreso: number
  sexoAlumno: string
  estatusAlumno: number
}

export function snapshotsDatosElementalesIguales(
  a: SnapshotDatosElementales,
  b: SnapshotDatosElementales
): boolean {
  return (
    a.apellidoPaterno === b.apellidoPaterno &&
    a.apellidoMaterno === b.apellidoMaterno &&
    a.nombre === b.nombre &&
    a.clavePersonal === b.clavePersonal &&
    a.cicloEscolar === b.cicloEscolar &&
    a.nivelEscolar === b.nivelEscolar &&
    a.gradoEscolar === b.gradoEscolar &&
    a.grupoEscolar === b.grupoEscolar &&
    a.curp === b.curp &&
    a.fechaNacimientoIso === b.fechaNacimientoIso &&
    a.fechaAltaIso === b.fechaAltaIso &&
    a.formaIngreso === b.formaIngreso &&
    a.sexoAlumno === b.sexoAlumno &&
    a.estatusAlumno === b.estatusAlumno
  )
}

export interface GuardarDatosElementalesPayload extends SnapshotDatosElementales {
  alumnoId: number
  detalleId: number | null
}

export type ResultadoGuardarDatosElementales =
  | { ok: true; detalleId: number | null }
  | { ok: false; mensaje: string }

/** Persiste cambios en `alumno` y `alumno_detalles`. */
export async function guardarDatosElementalesAlumno(
  payload: GuardarDatosElementalesPayload
): Promise<ResultadoGuardarDatosElementales> {
  const sexo = sexoAlumnoPorDefecto(payload.sexoAlumno) || null
  const curpNorm = normalizarCurp(payload.curp)
  const fechaAlta = payload.fechaAltaIso.trim() || null
  const fechaNac = payload.fechaNacimientoIso.trim() || null

  const { error: errorAlumno } = await supabase
    .from('alumno')
    .update({
      alumno_app: payload.apellidoPaterno.trim(),
      alumno_apm: payload.apellidoMaterno.trim(),
      alumno_nombre: payload.nombre.trim(),
      alumno_nivel: payload.nivelEscolar,
      alumno_grado: payload.gradoEscolar,
      alumno_grupo: payload.grupoEscolar,
      alumno_ciclo_escolar: payload.cicloEscolar,
      alumno_status: payload.estatusAlumno,
      alumno_nuevo_ingreso: payload.formaIngreso,
      alumno_alta: fechaAlta,
    })
    .eq('alumno_id', payload.alumnoId)

  if (errorAlumno) {
    console.error('Error al guardar alumno:', errorAlumno)
    return { ok: false, mensaje: errorAlumno.message }
  }

  const detallesUpdate = {
    alumno_clave: payload.clavePersonal.trim() || null,
    alumno_curp: curpNorm || null,
    alumno_fecha_nac: fechaNac,
    alumno_sexo: sexo,
  }

  let detalleId = payload.detalleId

  if (detalleId != null) {
    const { error: errorDetalle } = await supabase
      .from('alumno_detalles')
      .update(detallesUpdate)
      .eq('detalle_id', detalleId)

    if (errorDetalle) {
      console.error('Error al guardar detalles del alumno:', errorDetalle)
      return { ok: false, mensaje: errorDetalle.message }
    }
  } else {
    const hayDatosDetalle =
      detallesUpdate.alumno_clave != null ||
      detallesUpdate.alumno_curp != null ||
      detallesUpdate.alumno_fecha_nac != null ||
      detallesUpdate.alumno_sexo != null

    if (hayDatosDetalle) {
      const { data: insertado, error: errorInsert } = await supabase
        .from('alumno_detalles')
        .insert({ alumno_id: payload.alumnoId, ...detallesUpdate })
        .select('detalle_id')
        .single()

      if (errorInsert) {
        console.error('Error al crear detalles del alumno:', errorInsert)
        return { ok: false, mensaje: errorInsert.message }
      }

      detalleId = insertado?.detalle_id ?? null
    }
  }

  return { ok: true, detalleId }
}
