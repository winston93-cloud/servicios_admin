import { createBoletasDb } from './boletasInsforge'
import {
  BOLETAS_NIVEL_SECUNDARIA,
  MATERIA_IDS_MINDFULNESS,
  etiquetaGradoSecundaria,
  letraDesdeGrupoNum,
} from './boletasCiclo'

function parseNota(raw: string | number | null | undefined): number | null {
  if (raw == null) return null
  const s = String(raw).trim().replace(/,/g, '.')
  if (!s || /^-+$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n <= 0 || n > 10) return null
  return n
}

function truncar(n: number, dec: number): number {
  const f = 10 ** dec
  return (Math.floor(Math.abs(n) * f + 1e-9) / f) * (n < 0 ? -1 : 1)
}

function promedioLista(vals: number[], dec: number): number | null {
  if (!vals.length) return null
  return truncar(vals.reduce((a, b) => a + b, 0) / vals.length, dec)
}

export type PromedioAlumnoReporte = {
  alumno_id: number
  alumno_ref: number | null
  nombre: string
  grado: number
  grupo: number
  grado_etiqueta: string
  grupo_letra: string
  promedio: number | null
  bimestres: number
}

export type PromedioMateriaReporte = {
  materia_id: number
  materia_nombre: string
  materia_grado: number
  promedio: number | null
  n: number
}

export async function reportePromediosAlumnos(input: {
  ciclo: number
  grado?: number
  grupo?: number
}): Promise<PromedioAlumnoReporte[]> {
  const db = createBoletasDb()
  let q = db
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo'
    )
    .eq('alumno_nivel', BOLETAS_NIVEL_SECUNDARIA)
    .eq('alumno_ciclo_escolar', input.ciclo)
    .eq('alumno_status', 1)
    .order('alumno_grado')
    .order('alumno_grupo')
    .order('alumno_app')

  if (input.grado && input.grado > 0) q = q.eq('alumno_grado', input.grado)
  if (input.grupo && input.grupo > 0) q = q.eq('alumno_grupo', input.grupo)

  const { data: alumnos, error } = await q
  if (error) throw new Error(error.message)
  const ids = (alumnos ?? []).map((a) => Number(a.alumno_id))
  if (!ids.length) return []

  const { data: cals, error: errC } = await db
    .from('boleta_calificacion')
    .select('alumno_id, materia_id, calificacion_bimestre, calificacion_puntos')
    .eq('calificacion_ciclo_escolar', input.ciclo)
    .in('calificacion_bimestre', [1, 2, 3])
    .in('alumno_id', ids)

  if (errC) throw new Error(errC.message)

  const mind = new Set(MATERIA_IDS_MINDFULNESS)
  const porAlumno = new Map<number, Map<number, number[]>>()
  for (const row of cals ?? []) {
    if (mind.has(Number(row.materia_id) as 45 | 46 | 47)) continue
    const id = Number(row.alumno_id)
    const bim = Number(row.calificacion_bimestre)
    const nota = parseNota(row.calificacion_puntos as string)
    if (nota == null) continue
    if (!porAlumno.has(id)) porAlumno.set(id, new Map())
    const porBim = porAlumno.get(id)!
    if (!porBim.has(bim)) porBim.set(bim, [])
    porBim.get(bim)!.push(nota)
  }

  return (alumnos ?? []).map((a) => {
    const id = Number(a.alumno_id)
    const porBim = porAlumno.get(id) ?? new Map()
    const trimAvgs: number[] = []
    for (const bim of [1, 2, 3]) {
      const p = promedioLista(porBim.get(bim) ?? [], 1)
      if (p != null) trimAvgs.push(p)
    }
    const grado = Number(a.alumno_grado)
    const grupo = Number(a.alumno_grupo)
    return {
      alumno_id: id,
      alumno_ref: a.alumno_ref != null ? Number(a.alumno_ref) : null,
      nombre: [a.alumno_app, a.alumno_apm, a.alumno_nombre]
        .map((x) => String(x ?? '').trim())
        .filter(Boolean)
        .join(' '),
      grado,
      grupo,
      grado_etiqueta: etiquetaGradoSecundaria(grado),
      grupo_letra: letraDesdeGrupoNum(grupo),
      promedio: promedioLista(trimAvgs, 1),
      bimestres: trimAvgs.length,
    }
  })
}

export async function reportePromediosMaterias(input: {
  ciclo: number
  periodo: number
  grado?: number
}): Promise<PromedioMateriaReporte[]> {
  const db = createBoletasDb()
  let mq = db
    .from('boleta_materia')
    .select('materia_id, materia_nombre, materia_grado')
    .eq('materia_nivel', BOLETAS_NIVEL_SECUNDARIA)
    .order('materia_grado')
    .order('materia_orden')
  if (input.grado && input.grado > 0) mq = mq.eq('materia_grado', input.grado)
  const { data: materias, error } = await mq
  if (error) throw new Error(error.message)

  const mind = new Set(MATERIA_IDS_MINDFULNESS)
  const out: PromedioMateriaReporte[] = []

  for (const m of materias ?? []) {
    const mid = Number(m.materia_id)
    if (mind.has(mid as 45 | 46 | 47)) continue
    const { data: cals } = await db
      .from('boleta_calificacion')
      .select('calificacion_puntos')
      .eq('materia_id', mid)
      .eq('calificacion_bimestre', input.periodo)
      .eq('calificacion_ciclo_escolar', input.ciclo)

    const vals = (cals ?? [])
      .map((c) => parseNota(c.calificacion_puntos as string))
      .filter((n): n is number => n != null)

    out.push({
      materia_id: mid,
      materia_nombre: String(m.materia_nombre),
      materia_grado: Number(m.materia_grado),
      promedio: promedioLista(vals, 1),
      n: vals.length,
    })
  }

  return out
}
