import { supabase } from './supabase'

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
}

const SELECT_ALUMNO =
  'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, alumno_status, alumno_ciclo_escolar'

function cicloNumerico(ciclo: string | number | null | undefined): number {
  if (ciclo == null || ciclo === '') return 0
  const n = typeof ciclo === 'number' ? ciclo : parseInt(String(ciclo), 10)
  return Number.isNaN(n) ? 0 : n
}

/** Registro vigente por número de control (ciclo escolar más reciente, activo). */
export async function obtenerAlumnoPorRef(alumnoRef: string): Promise<AlumnoRegistro | null> {
  const ref = String(alumnoRef ?? '').trim()
  if (!ref) return null

  const refFiltro = /^\d+$/.test(ref) ? parseInt(ref, 10) : ref

  const { data, error } = await supabase
    .from('alumno')
    .select(SELECT_ALUMNO)
    .eq('alumno_ref', refFiltro)
    .eq('alumno_status', 1)
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
