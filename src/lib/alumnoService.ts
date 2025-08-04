import { supabase } from './supabase'

export interface Alumno {
  alumno_id: number
  alumno_ref: string
  alumno_app: string
  alumno_apm: string
  alumno_nombre: string
  alumno_nivel: number
}

export interface AlumnoSearchResult {
  alumno_id: number
  alumno_ref: string
  alumno_app: string
  alumno_apm: string
  alumno_nombre: string
  alumno_nivel: number
  full_name: string
  display_name: string
}

export async function searchAlumnos(query: string): Promise<AlumnoSearchResult[]> {
  if (!query || query.trim().length < 2) {
    return []
  }

  const searchTerm = query.trim().toLowerCase()

  const { data, error } = await supabase
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel')
    .or(`alumno_nombre.ilike.%${searchTerm}%,alumno_app.ilike.%${searchTerm}%,alumno_apm.ilike.%${searchTerm}%`)
    .limit(10)

  if (error) {
    console.error('Error searching alumnos:', error)
    return []
  }

  return data?.map(alumno => ({
    ...alumno,
    full_name: `${alumno.alumno_app} ${alumno.alumno_apm} ${alumno.alumno_nombre}`.trim(),
    display_name: `${alumno.alumno_app} ${alumno.alumno_apm} ${alumno.alumno_nombre}`.trim()
  })) || []
} 