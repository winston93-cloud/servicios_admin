import { createBoletasDb } from './boletasInsforge'
import { MATERIA_SLOT_EN, MATERIA_SLOT_ES } from './catalogoMaestrosConstants'
import {
  esGradoKinderEn,
  etiquetaGrupoKinderEn,
  letraDesdeGrupoNumero,
  type KinderEnGrado,
} from './boletasKinderEnCatalog'
import type { BoletaModulo } from './boletasPortal'
import { gruposConAlumnos } from './boletasKinderEnService'
import { gruposConAlumnosKinderEs } from './boletasKinderEsService'
import { docentesPorGrupoKinder } from './boletasKinderDocentesGrupo'

export type ModuloCapturaKinder = Extract<BoletaModulo, 'kinder-en' | 'kinder-es'>

export type GrupoCaptura = {
  modulo: ModuloCapturaKinder
  grado: KinderEnGrado
  grupo: string
  etiqueta: string
  /** Solo en supervisión: docente asignada al grupo. */
  teacher?: string | null
}

/** Supervisión: todos los grupos con alumnos en el ciclo (inglés y español), con su docente asignada. */
export async function gruposSupervisionKinder(ciclo: number): Promise<GrupoCaptura[]> {
  const [gruposEn, gruposEs, docEn, docEs] = await Promise.all([
    gruposConAlumnos(ciclo),
    gruposConAlumnosKinderEs(ciclo),
    docentesPorGrupoKinder('en'),
    docentesPorGrupoKinder('es'),
  ])
  const armar = (modulo: ModuloCapturaKinder, grado: KinderEnGrado, grupo: string, doc: typeof docEn) => ({
    modulo,
    grado,
    grupo,
    etiqueta: etiquetaGrupoKinderEn(grado, grupo),
    teacher: doc.get(`${grado}-${grupo}`)?.nombre ?? null,
  })
  return [
    ...gruposEn.map((g) => armar('kinder-en', g.grado, g.grupo, docEn)),
    ...gruposEs.map((g) => armar('kinder-es', g.grado, g.grupo, docEs)),
  ]
}

/**
 * Grupos asignados al docente en `boleta_maestro_grupo` (slot Teacher = inglés, Maestro(a) = español).
 * Maternal guarda el grupo en `materia_grado` (Maternal A = 1, B = 2).
 */
export async function gruposDeMaestro(maestroId: number, niveles: number[]): Promise<GrupoCaptura[]> {
  const db = createBoletasDb()
  const { data: asig, error } = await db
    .from('boleta_maestro_grupo')
    .select('materia_id, grupo_letra')
    .eq('maestro_id', maestroId)
  if (error) throw new Error(error.message)
  const matIds = [...new Set((asig ?? []).map((a) => Number(a.materia_id)))]
  if (!matIds.length) return []
  const { data: materias, error: errMat } = await db
    .from('boleta_materia')
    .select('materia_id, materia_nombre, materia_nivel, materia_grado')
    .in('materia_id', matIds)
    .in('materia_nivel', niveles)
  if (errMat) throw new Error(errMat.message)
  const porId = new Map((materias ?? []).map((m) => [Number(m.materia_id), m]))

  const out = new Map<string, GrupoCaptura>()
  for (const a of asig ?? []) {
    const m = porId.get(Number(a.materia_id))
    if (!m) continue
    const nombre = String(m.materia_nombre ?? '')
    const modulo =
      nombre === MATERIA_SLOT_EN.nombre ? 'kinder-en' : nombre === MATERIA_SLOT_ES.nombre ? 'kinder-es' : null
    if (!modulo) continue
    const nivel = Number(m.materia_nivel)
    const gradoMat = Number(m.materia_grado)
    const pares: { grado: KinderEnGrado; grupo: string }[] = []
    if (nivel === 1) {
      if (gradoMat === 1 || gradoMat === 2) pares.push({ grado: 0, grupo: letraDesdeGrupoNumero(gradoMat) })
    } else if (nivel === 2 && esGradoKinderEn(gradoMat) && gradoMat > 0) {
      for (const letra of String(a.grupo_letra ?? '').toUpperCase()) {
        if ('ABCD'.includes(letra)) pares.push({ grado: gradoMat, grupo: letra })
      }
    }
    for (const p of pares) {
      out.set(`${modulo}-${p.grado}-${p.grupo}`, {
        modulo,
        ...p,
        etiqueta: etiquetaGrupoKinderEn(p.grado, p.grupo),
      })
    }
  }
  return [...out.values()].sort(
    (a, b) => a.modulo.localeCompare(b.modulo) || a.grado - b.grado || a.grupo.localeCompare(b.grupo)
  )
}

export async function maestroTieneGrupo(
  maestroId: number,
  niveles: number[],
  modulo: ModuloCapturaKinder,
  grado: number,
  grupo: string
): Promise<boolean> {
  const grupos = await gruposDeMaestro(maestroId, niveles)
  return grupos.some((g) => g.modulo === modulo && g.grado === grado && g.grupo === grupo)
}

/** Teacher de inglés por grupo (para el tablero de la directora). */
export function teachersPorGrupoKinderEn() {
  return docentesPorGrupoKinder('en')
}
