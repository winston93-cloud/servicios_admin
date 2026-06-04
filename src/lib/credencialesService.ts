import type { AppDatabaseClient } from '@/lib/dbTypes'
import { etiquetaGradoCredencial, etiquetaGrupo } from './credencialesEtiquetas'

export interface PersonaCredencial {
  id: number
  ref: string
  app: string
  apm: string
  nombre: string
  nivel: number
  grado: number
  grupo: number
  gradoTexto: string
  grupoLetra: string
  esMaestro: boolean
  sexoMaestro: number | null
}

export interface FiltrosCredencialesAlumnos {
  cicloEscolar: number
  nivel?: number
  grado?: number
  grupo?: number
  refs?: string[]
}

export interface FiltrosCredencialesMaestros {
  nivel?: number
}

function mapAlumno(row: Record<string, unknown>): PersonaCredencial {
  const nivel = Number(row.alumno_nivel)
  const grado = Number(row.alumno_grado)
  const grupo = Number(row.alumno_grupo)
  return {
    id: Number(row.alumno_id),
    ref: String(row.alumno_ref ?? '').padStart(5, '0'),
    app: String(row.alumno_app ?? '').trim(),
    apm: String(row.alumno_apm ?? '').trim(),
    nombre: String(row.alumno_nombre ?? '').trim(),
    nivel,
    grado,
    grupo,
    gradoTexto: etiquetaGradoCredencial(nivel, grado),
    grupoLetra: etiquetaGrupo(grupo),
    esMaestro: false,
    sexoMaestro: null,
  }
}

export async function listarAlumnosCredenciales(
  supabase: AppDatabaseClient,
  filtros: FiltrosCredencialesAlumnos
): Promise<PersonaCredencial[]> {
  const { cicloEscolar, nivel, grado, grupo, refs } = filtros

  if (refs?.length) {
    const nums = refs.map((r) => r.replace(/\D/g, '')).filter(Boolean)
    const { data, error } = await supabase
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo'
      )
      .in('alumno_ref', nums)
      .eq('alumno_status', 1)
      .order('alumno_nivel')
      .order('alumno_grado')
      .order('alumno_app')

    if (error) throw new Error(error.message)
    return (data ?? []).map(mapAlumno)
  }

  let q = supabase
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo'
    )
    .eq('alumno_ciclo_escolar', cicloEscolar)
    .eq('alumno_status', 1)

  if (nivel && nivel > 0) q = q.eq('alumno_nivel', nivel)
  if (grado && grado > 0) q = q.eq('alumno_grado', grado)
  if (grupo && grupo > 0) q = q.eq('alumno_grupo', grupo)

  const { data, error } = await q
    .order('alumno_nivel')
    .order('alumno_grado')
    .order('alumno_app')

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapAlumno)
}

export async function listarMaestrosCredenciales(
  supabase: AppDatabaseClient,
  filtros: FiltrosCredencialesMaestros
): Promise<PersonaCredencial[]> {
  const { data: maestros, error } = await supabase
    .from('boleta_maestro')
    .select('maestro_id, maestro_app, maestro_apm, maestro_nombre, maestro_sexo')
    .order('maestro_app')

  if (error) {
    if (/does not exist|relation/i.test(error.message)) {
      throw new Error(
        'La tabla boleta_maestro no está en Supabase. Importa las tablas de boletas del sistema legacy.'
      )
    }
    throw new Error(error.message)
  }

  const ids = (maestros ?? []).map((m) => m.maestro_id as number)
  const nivelPorMaestro = new Map<number, number>()

  if (ids.length) {
    const { data: grupos } = await supabase
      .from('boleta_maestro_grupo')
      .select('maestro_id, materia_id')
      .in('maestro_id', ids)

    const materiaIds = [...new Set((grupos ?? []).map((g) => g.materia_id as number).filter(Boolean))]
    const nivelMateria = new Map<number, number>()

    if (materiaIds.length) {
      const { data: materias } = await supabase
        .from('boleta_materia')
        .select('materia_id, materia_nivel, materia_grado')
        .in('materia_id', materiaIds)

      for (const m of materias ?? []) {
        nivelMateria.set(m.materia_id as number, Number(m.materia_nivel))
      }
    }

    for (const g of grupos ?? []) {
      const mid = g.maestro_id as number
      const nv = nivelMateria.get(g.materia_id as number)
      if (nv && !nivelPorMaestro.has(mid)) nivelPorMaestro.set(mid, nv)
    }
  }

  let lista = (maestros ?? []).map((m) => {
    const nivel = nivelPorMaestro.get(m.maestro_id as number) ?? 3
    return {
      id: m.maestro_id as number,
      ref: String(m.maestro_id).padStart(5, '0'),
      app: String(m.maestro_app ?? '').trim(),
      apm: String(m.maestro_apm ?? '').trim(),
      nombre: String(m.maestro_nombre ?? '').trim(),
      nivel,
      grado: 0,
      grupo: 0,
      gradoTexto: '',
      grupoLetra: '',
      esMaestro: true,
      sexoMaestro: m.maestro_sexo != null ? Number(m.maestro_sexo) : 0,
    } satisfies PersonaCredencial
  })

  if (filtros.nivel && filtros.nivel > 0) {
    lista = lista.filter((m) => m.nivel === filtros.nivel)
  }

  return lista
}
