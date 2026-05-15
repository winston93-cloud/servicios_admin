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
  alumno_nombre_completo?: string | null
  alumno_status?: number | null
  alumno_ciclo_escolar?: string | number | null
}

export async function obtenerAlumnoPorId(alumnoId: number): Promise<AlumnoRegistro | null> {
  const { data, error } = await supabase
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, alumno_nombre_completo, alumno_status, alumno_ciclo_escolar'
    )
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
}

export async function obtenerAlumnoDetallesPorAlumnoId(
  alumnoId: number
): Promise<AlumnoDetallesRegistro | null> {
  const { data, error } = await supabase
    .from('alumno_detalles')
    .select('detalle_id, alumno_id, alumno_clave')
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
  const [alumno, detalles] = await Promise.all([
    obtenerAlumnoPorId(alumnoId),
    obtenerAlumnoDetallesPorAlumnoId(alumnoId),
  ])

  if (!alumno) return null
  return { alumno, detalles }
}
