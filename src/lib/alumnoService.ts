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

  // Búsqueda optimizada con índices - usar gin_trgm para búsqueda de texto
  const { data, error } = await supabase
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel')
    .eq('alumno_ciclo_escolar', '22')
    .eq('alumno_status', 1)
    .or(`alumno_app.ilike.%${searchTerm}%,alumno_apm.ilike.%${searchTerm}%,alumno_nombre.ilike.%${searchTerm}%`)
    .limit(5) // Solo 5 resultados más relevantes
    .order('alumno_app', { ascending: true }) // Ordenar para mejor UX

  const queryTime = Date.now() - startTime
  console.log(`⚡ Consulta completada en ${queryTime}ms`)

  if (error) {
    console.error('❌ Error searching alumnos:', error)
    return []
  }

  console.log(`📊 Resultados de BD: ${data?.length || 0}`)

  // Crear nombres completos y filtrar localmente
  const results = data?.map(alumno => ({
    ...alumno,
    full_name: `${alumno.alumno_app} ${alumno.alumno_apm} ${alumno.alumno_nombre}`.trim(),
    display_name: `${alumno.alumno_app} ${alumno.alumno_apm} ${alumno.alumno_nombre}`.trim()
  })) || []

  // Filtrar localmente para mayor precisión
  const filteredResults = results.filter(alumno => {
    const fullName = alumno.display_name.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    return fullName.includes(searchLower);
  });

  // Guardar en caché
  searchCache.set(cacheKey, filteredResults);
  
  // Limpiar caché antiguo cada 5 minutos
  setTimeout(() => {
    searchCache.delete(cacheKey);
  }, CACHE_DURATION);

  const totalTime = Date.now() - startTime
  console.log(`✅ Búsqueda completada en ${totalTime}ms - ${filteredResults.length} resultados`)

  return filteredResults.slice(0, 5); // Solo 5 resultados más relevantes
} 