import { createBoletasDb } from './boletasInsforge'
import { MATERIA_SLOT_EN, MATERIA_SLOT_ES } from './catalogoMaestrosConstants'
import { letraDesdeGrupoNumero } from './boletasKinderEnCatalog'

export type IdiomaKinder = 'en' | 'es'

/**
 * Docente de cada grupo por idioma (slot Teacher = inglés, Maestro(a) = español).
 * Clave `${grado}-${grupo}`; Maternal es grado 0 con grupo A/B (guardado en materia_grado 1/2).
 * `niveles`: [1, 2] Maternal/Kinder (default) o [3] Primaria.
 */
export async function docentesPorGrupoKinder(
  idioma: IdiomaKinder,
  niveles: number[] = [1, 2]
): Promise<Map<string, { maestroId: number; nombre: string }>> {
  const db = createBoletasDb()
  const { data: materias, error } = await db
    .from('boleta_materia')
    .select('materia_id, materia_nivel, materia_grado')
    .in('materia_nivel', niveles)
    .eq('materia_nombre', idioma === 'en' ? MATERIA_SLOT_EN.nombre : MATERIA_SLOT_ES.nombre)
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
