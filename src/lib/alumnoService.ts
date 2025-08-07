import { supabase } from './supabase';

export interface AlumnoSearchResult {
  alumno_id: number
  alumno_ref: string
  alumno_app: string
  alumno_apm: string
  alumno_nombre: string
  alumno_nivel: number
  alumno_nombre_completo: string
  full_name: string
  display_name: string
}

// Cache local para evitar consultas repetidas
const searchCache = new Map<string, AlumnoSearchResult[]>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export async function searchAlumnos(query: string): Promise<AlumnoSearchResult[]> {
  if (!query || query.trim().length < 2) {
    return []
  }

  // Limpiar espacios múltiples pero mantener espacios simples
  const searchTerm = query.replace(/\s+/g, ' ').trim()
  
  // Verificar caché primero
  const cacheKey = searchTerm.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached) {
    console.log('📋 Resultado desde caché:', searchTerm);
    return cached;
  }
  
  console.log('🔍 Iniciando búsqueda:', searchTerm)
  const startTime = Date.now()

  // Búsqueda optimizada usando el campo alumno_nombre_completo
  const { data, error } = await supabase
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_nombre_completo')
    .eq('alumno_ciclo_escolar', '22')
    .eq('alumno_status', 1)
    .ilike('alumno_nombre_completo', `%${searchTerm}%`)
    .limit(5) // Solo 5 resultados más relevantes
    .order('alumno_nombre_completo', { ascending: true }) // Ordenar por nombre completo

  const queryTime = Date.now() - startTime
  console.log(`⚡ Consulta completada en ${queryTime}ms`)

  if (error) {
    console.error('❌ Error searching alumnos:', error)
    return []
  }

  console.log(`📊 Resultados de BD: ${data?.length || 0}`)

  // Usar el campo alumno_nombre_completo directamente
  const results = data?.map(alumno => ({
    ...alumno,
    full_name: alumno.alumno_nombre_completo,
    display_name: alumno.alumno_nombre_completo
  })) || []

  // Guardar en caché
  searchCache.set(cacheKey, results);
  
  // Limpiar caché antiguo cada 5 minutos
  setTimeout(() => {
    searchCache.delete(cacheKey);
  }, CACHE_DURATION);

  const totalTime = Date.now() - startTime
  console.log(`✅ Búsqueda completada en ${totalTime}ms - ${results.length} resultados`)

  return results.slice(0, 5); // Solo 5 resultados más relevantes
} 