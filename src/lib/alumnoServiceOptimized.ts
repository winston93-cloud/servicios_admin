import { supabase } from './supabase';

export interface AlumnoSearchResult {
  alumno_id: number;
  alumno_ref: string;
  alumno_app: string;
  alumno_apm: string;
  alumno_nombre: string;
  alumno_nivel: string;
  full_name: string;
  display_name: string;
  similarity_score?: number;
}

// Cache local para evitar consultas repetidas
const searchCache = new Map<string, AlumnoSearchResult[]>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export async function searchAlumnosOptimized(query: string): Promise<AlumnoSearchResult[]> {
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
  
  console.log('🚀 Iniciando búsqueda optimizada:', searchTerm)
  const startTime = Date.now()

  // Usar función SQL optimizada con índices GIN
  const { data, error } = await supabase
    .rpc('search_alumnos_optimized', {
      search_query: searchTerm
    })

  const queryTime = Date.now() - startTime
  console.log(`⚡ Consulta optimizada completada en ${queryTime}ms`)

  if (error) {
    console.error('❌ Error en búsqueda optimizada:', error)
    // Fallback a búsqueda normal
    return searchAlumnosFallback(searchTerm);
  }

  console.log(`📊 Resultados optimizados: ${data?.length || 0}`)

  // Crear nombres completos
  const results = data?.map((alumno: any) => ({
    ...alumno,
    full_name: `${alumno.alumno_app} ${alumno.alumno_apm} ${alumno.alumno_nombre}`.trim(),
    display_name: `${alumno.alumno_app} ${alumno.alumno_apm} ${alumno.alumno_nombre}`.trim()
  })) || []

  // Guardar en caché
  searchCache.set(cacheKey, results);
  
  // Limpiar caché antiguo cada 5 minutos
  setTimeout(() => {
    searchCache.delete(cacheKey);
  }, CACHE_DURATION);

  const totalTime = Date.now() - startTime
  console.log(`✅ Búsqueda optimizada completada en ${totalTime}ms - ${results.length} resultados`)

  return results;
}

// Función fallback si la función optimizada no existe
async function searchAlumnosFallback(searchTerm: string): Promise<AlumnoSearchResult[]> {
  console.log('🔄 Usando búsqueda fallback');
  
  const { data, error } = await supabase
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel')
    .eq('alumno_ciclo_escolar', '22')
    .eq('alumno_status', 1)
    .or(`alumno_app.ilike.%${searchTerm}%,alumno_apm.ilike.%${searchTerm}%,alumno_nombre.ilike.%${searchTerm}%`)
    .limit(5)
    .order('alumno_app', { ascending: true })

  if (error) {
    console.error('❌ Error en fallback:', error)
    return []
  }

  return data?.map((alumno: any) => ({
    ...alumno,
    full_name: `${alumno.alumno_app} ${alumno.alumno_apm} ${alumno.alumno_nombre}`.trim(),
    display_name: `${alumno.alumno_app} ${alumno.alumno_apm} ${alumno.alumno_nombre}`.trim()
  })) || []
}
