import { createBoletasDb } from './boletasInsforge'
import { MATERIA_SLOT_EN, MATERIA_SLOT_ES } from './catalogoMaestrosConstants'
import {
  esGradoKinderEn,
  etiquetaGrupoKinderEn,
  letraDesdeGrupoNumero,
  type KinderEnGrado,
} from './boletasKinderEnCatalog'
import type { BoletaModulo } from './boletasPortal'

export type GrupoCaptura = {
  modulo: Extract<BoletaModulo, 'kinder-en' | 'kinder-es'>
  grado: KinderEnGrado
  grupo: string
  etiqueta: string
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
  modulo: GrupoCaptura['modulo'],
  grado: number,
  grupo: string
): Promise<boolean> {
  const grupos = await gruposDeMaestro(maestroId, niveles)
  return grupos.some((g) => g.modulo === modulo && g.grado === grado && g.grupo === grupo)
}

/** Teacher de inglés por grupo (para el tablero de la directora). */
export async function teachersPorGrupoKinderEn(): Promise<Map<string, { maestroId: number; nombre: string }>> {
  const db = createBoletasDb()
  const { data: materias, error } = await db
    .from('boleta_materia')
    .select('materia_id, materia_nivel, materia_grado')
    .in('materia_nivel', [1, 2])
    .eq('materia_nombre', MATERIA_SLOT_EN.nombre)
  if (error) throw new Error(error.message)
  const matPorId = new Map((materias ?? []).map((m) => [Number(m.materia_id), m]))
  if (!matPorId.size) return new Map()
  const { data: asig, error: errA } = await db
    .from('boleta_maestro_grupo')
    .select('maestro_id, materia_id, grupo_letra')
    .in('materia_id', [...matPorId.keys()])
  if (errA) throw new Error(errA.message)
  const maestroIds = [...new Set((asig ?? []).map((a) => Number(a.maestro_id)))]
  const nombres = new Map<number, string>()
  if (maestroIds.length) {
    const { data: ms } = await db
      .from('boleta_maestro')
      .select('maestro_id, maestro_nombre, maestro_app, maestro_apm')
      .in('maestro_id', maestroIds)
    for (const m of ms ?? []) {
      nombres.set(
        Number(m.maestro_id),
        [m.maestro_nombre, m.maestro_app, m.maestro_apm].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ')
      )
    }
  }
  const out = new Map<string, { maestroId: number; nombre: string }>()
  for (const a of asig ?? []) {
    const m = matPorId.get(Number(a.materia_id))
    if (!m) continue
    const maestroId = Number(a.maestro_id)
    const info = { maestroId, nombre: nombres.get(maestroId) || `#${maestroId}` }
    const gradoMat = Number(m.materia_grado)
    if (Number(m.materia_nivel) === 1) {
      if (gradoMat === 1 || gradoMat === 2) out.set(`0-${letraDesdeGrupoNumero(gradoMat)}`, info)
    } else {
      for (const letra of String(a.grupo_letra ?? '').toUpperCase()) {
        if ('ABCD'.includes(letra)) out.set(`${gradoMat}-${letra}`, info)
      }
    }
  }
  return out
}
