import { createBoletasDb } from './boletasInsforge'
import { MATERIA_SLOT_EN, MATERIA_SLOT_ES } from './catalogoMaestrosConstants'
import {
  esGradoKinderEn,
  etiquetaGrupoKinderEn,
  letraDesdeGrupoNumero,
} from './boletasKinderEnCatalog'
import type { BoletaModulo } from './boletasPortal'
import type { BoletasCapturaSlug } from './boletasCapturaAuth'
import { gruposConAlumnos } from './boletasKinderEnService'
import { gruposConAlumnosKinderEs } from './boletasKinderEsService'
import { docentesPorGrupoKinder } from './boletasKinderDocentesGrupo'
import {
  BOLETAS_NIVEL_PRIMARIA,
  esGradoPrimaria,
  etiquetaGrupoPrimaria,
  gruposConAlumnosPrimaria,
} from './boletasPrimariaComun'

export type ModuloCapturaKinder = Extract<BoletaModulo, 'kinder-en' | 'kinder-es'>
export type ModuloCapturaPrimaria = Extract<BoletaModulo, 'primaria-es' | 'primaria-en'>
export type ModuloCaptura = ModuloCapturaKinder | ModuloCapturaPrimaria

export type GrupoCaptura = {
  modulo: ModuloCaptura
  grado: number
  grupo: string
  etiqueta: string
  /** Solo en supervisión: docente asignada al grupo. */
  teacher?: string | null
}

function etiquetaGrupo(modulo: ModuloCaptura, grado: number, grupo: string): string {
  return modulo.startsWith('primaria') ? etiquetaGrupoPrimaria(grado, grupo) : etiquetaGrupoKinderEn(grado, grupo)
}

/** Supervisión: todos los grupos con alumnos en el ciclo (inglés y español) del nivel, con su docente asignada. */
export async function gruposSupervision(slug: BoletasCapturaSlug, ciclo: number): Promise<GrupoCaptura[]> {
  const armar = (
    modulo: ModuloCaptura,
    g: { grado: number; grupo: string },
    doc: Map<string, { nombre: string }>
  ): GrupoCaptura => ({
    modulo,
    grado: g.grado,
    grupo: g.grupo,
    etiqueta: etiquetaGrupo(modulo, g.grado, g.grupo),
    teacher: doc.get(`${g.grado}-${g.grupo}`)?.nombre ?? null,
  })

  if (slug === 'primaria') {
    const niveles = [BOLETAS_NIVEL_PRIMARIA]
    const [grupos, docEs, docEn] = await Promise.all([
      gruposConAlumnosPrimaria(ciclo),
      docentesPorGrupoKinder('es', niveles),
      docentesPorGrupoKinder('en', niveles),
    ])
    return [
      ...grupos.map((g) => armar('primaria-es', g, docEs)),
      ...grupos.map((g) => armar('primaria-en', g, docEn)),
    ]
  }

  const [gruposEn, gruposEs, docEn, docEs] = await Promise.all([
    gruposConAlumnos(ciclo),
    gruposConAlumnosKinderEs(ciclo),
    docentesPorGrupoKinder('en'),
    docentesPorGrupoKinder('es'),
  ])
  return [...gruposEn.map((g) => armar('kinder-en', g, docEn)), ...gruposEs.map((g) => armar('kinder-es', g, docEs))]
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
    const idioma = nombre === MATERIA_SLOT_EN.nombre ? 'en' : nombre === MATERIA_SLOT_ES.nombre ? 'es' : null
    if (!idioma) continue
    const nivel = Number(m.materia_nivel)
    const gradoMat = Number(m.materia_grado)
    const modulo: ModuloCaptura =
      nivel === BOLETAS_NIVEL_PRIMARIA ? (`primaria-${idioma}` as const) : (`kinder-${idioma}` as const)
    const letras = [...String(a.grupo_letra ?? '').toUpperCase()]
    const pares: { grado: number; grupo: string }[] = []
    if (nivel === 1) {
      if (gradoMat === 1 || gradoMat === 2) pares.push({ grado: 0, grupo: letraDesdeGrupoNumero(gradoMat) })
    } else if (nivel === 2 && esGradoKinderEn(gradoMat) && gradoMat > 0) {
      for (const letra of letras) if ('ABCD'.includes(letra)) pares.push({ grado: gradoMat, grupo: letra })
    } else if (nivel === BOLETAS_NIVEL_PRIMARIA && esGradoPrimaria(gradoMat)) {
      for (const letra of letras) if ('ABC'.includes(letra)) pares.push({ grado: gradoMat, grupo: letra })
    }
    for (const p of pares) {
      out.set(`${modulo}-${p.grado}-${p.grupo}`, { modulo, ...p, etiqueta: etiquetaGrupo(modulo, p.grado, p.grupo) })
    }
  }
  return [...out.values()].sort(
    (a, b) => a.modulo.localeCompare(b.modulo) || a.grado - b.grado || a.grupo.localeCompare(b.grupo)
  )
}

export async function maestroTieneGrupo(
  maestroId: number,
  niveles: number[],
  modulo: ModuloCaptura,
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
