import { supabase } from './supabase';

export interface AlumnoSearchResult {
  alumno_id: number
  alumno_ref: string
  alumno_app: string
  alumno_apm: string
  alumno_nombre: string
  alumno_nivel: number
  alumno_grado?: string
  alumno_grupo?: string
  alumno_nombre_completo: string
  full_name: string
  display_name: string
  type?: 'alumno' | 'personal' // Nuevo campo para identificar el tipo
}

export interface PersonalAsAlumnoResult {
  alumno_id: number // ID del personal convertido
  alumno_ref: string // ID del personal como string
  alumno_app: string
  alumno_apm: string
  alumno_nombre: string
  alumno_nivel: number // Siempre será 0 para personal
  alumno_grado?: string
  alumno_grupo?: string
  alumno_nombre_completo: string
  full_name: string
  display_name: string
  type: 'personal'
}

export type CombinedSearchResult = AlumnoSearchResult | PersonalAsAlumnoResult;

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
    .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_nombre_completo')
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

// Nueva función que busca en ambas tablas: alumno y personal
export async function searchAlumnosAndPersonal(query: string): Promise<CombinedSearchResult[]> {
  if (!query || query.trim().length < 2) {
    return []
  }

  const searchTerm = query.replace(/\s+/g, ' ').trim()
  console.log('🔍 Búsqueda combinada (Alumnos + Personal):', searchTerm)
  const startTime = Date.now()

  try {
    // Búsqueda en paralelo en ambas tablas
    const [alumnosPromise, personalPromise] = await Promise.allSettled([
      // Búsqueda en tabla alumno
      supabase
        .from('alumno')
        .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_nombre_completo')
        .eq('alumno_ciclo_escolar', '22')
        .eq('alumno_status', 1)
        .ilike('alumno_nombre_completo', `%${searchTerm}%`)
        .limit(3) // Reducir a 3 para dejar espacio a personal
        .order('alumno_nombre_completo', { ascending: true }),
      
      // Búsqueda en tabla personal
      supabase
        .from('personal')
        .select('id, personal_nombre, personal_app, personal_apm, personal_nombre_completo')
        .ilike('personal_nombre_completo', `%${searchTerm}%`)
        .limit(3) // Máximo 3 resultados de personal
        .order('personal_nombre_completo', { ascending: true })
    ]);

    const results: CombinedSearchResult[] = [];

    // Procesar resultados de alumnos
    if (alumnosPromise.status === 'fulfilled' && alumnosPromise.value.data) {
      const alumnosResults = alumnosPromise.value.data.map(alumno => ({
        ...alumno,
        full_name: alumno.alumno_nombre_completo,
        display_name: alumno.alumno_nombre_completo,
        type: 'alumno' as const
      }));
      results.push(...alumnosResults);
    }

    // Procesar resultados de personal (convertir a formato de alumno)
    if (personalPromise.status === 'fulfilled' && personalPromise.value.data) {
      const personalResults: PersonalAsAlumnoResult[] = personalPromise.value.data.map(personal => ({
        alumno_id: personal.id,
        alumno_ref: `P${personal.id}`, // Prefijo P para identificar como Personal
        alumno_app: personal.personal_app,
        alumno_apm: personal.personal_apm,
        alumno_nombre: personal.personal_nombre,
        alumno_nivel: 0, // Nivel 0 para personal (diferente de los alumnos)
        alumno_grado: 'N/A',
        alumno_grupo: 'N/A',
        alumno_nombre_completo: personal.personal_nombre_completo,
        full_name: personal.personal_nombre_completo,
        display_name: personal.personal_nombre_completo,
        type: 'personal' as const
      }));
      results.push(...personalResults);
    }

    // Ordenar todos los resultados por nombre completo
    results.sort((a, b) => a.alumno_nombre_completo.localeCompare(b.alumno_nombre_completo));

    const queryTime = Date.now() - startTime
    console.log(`⚡ Búsqueda combinada completada en ${queryTime}ms - ${results.length} resultados (Alumnos: ${results.filter(r => r.type === 'alumno').length}, Personal: ${results.filter(r => r.type === 'personal').length})`)

    return results.slice(0, 5); // Máximo 5 resultados combinados

  } catch (error) {
    console.error('❌ Error en búsqueda combinada:', error)
    return []
  }
} 