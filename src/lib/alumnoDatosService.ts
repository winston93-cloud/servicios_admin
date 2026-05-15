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
