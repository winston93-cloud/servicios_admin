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

  // Limpiar espacios múltiples pero mantener espacios simples
  const searchTerm = query.replace(/\s+/g, ' ').trim()

  // Dividir en palabras para buscar cada una por separado
  const searchWords = searchTerm.split(' ').filter(word => word.length > 0)

  // Buscar en cada campo por separado
  const { data, error } = await supabase
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel')
    .or(`alumno_app.ilike.%${searchWords[0]}%,alumno_apm.ilike.%${searchWords[0]}%,alumno_nombre.ilike.%${searchWords[0]}%`)
    .limit(50) // Obtener más para filtrar mejor

  if (error) {
    console.error('Error searching alumnos:', error)
    return []
  }



  // Crear nombres completos y filtrar localmente
  const results = data?.map(alumno => ({
    ...alumno,
    full_name: `${alumno.alumno_app} ${alumno.alumno_apm} ${alumno.alumno_nombre}`.trim(),
    display_name: `${alumno.alumno_app} ${alumno.alumno_apm} ${alumno.alumno_nombre}`.trim()
  })) || []

  // Filtrar para asegurar que todas las palabras estén presentes
  const filteredResults = results.filter(alumno => {
    const fullName = alumno.display_name.toLowerCase();
    return searchWords.every(word => fullName.includes(word.toLowerCase()));
  });

  return filteredResults.slice(0, 10); // Limitar a 10 resultados
} 