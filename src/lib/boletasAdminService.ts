import { createBoletasDb } from './boletasInsforge'
import {
  BOLETAS_NIVEL_SECUNDARIA,
  MATERIA_IDS_MINDFULNESS,
  grupoCoincide,
} from './boletasCiclo'

export async function listarMaterias(grado?: number) {
  const db = createBoletasDb()
  let q = db
    .from('boleta_materia')
    .select('materia_id, materia_nombre, materia_nivel, materia_grado, materia_orden')
    .eq('materia_nivel', BOLETAS_NIVEL_SECUNDARIA)
    .order('materia_grado')
    .order('materia_orden')
  if (grado && grado > 0) q = q.eq('materia_grado', grado)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertMateria(row: {
  materia_id?: number
  materia_nombre: string
  materia_grado: number
  materia_orden?: number
}) {
  const db = createBoletasDb()
  const payload = {
    materia_id: row.materia_id,
    materia_nombre: row.materia_nombre.trim(),
    materia_nivel: BOLETAS_NIVEL_SECUNDARIA,
    materia_grado: Number(row.materia_grado),
    materia_orden: Number(row.materia_orden ?? 0),
  }
  if (!payload.materia_id) {
    const { data: maxRows } = await db
      .from('boleta_materia')
      .select('materia_id')
      .order('materia_id', { ascending: false })
      .limit(1)
    payload.materia_id = Number(maxRows?.[0]?.materia_id ?? 0) + 1
  }
  const { error } = await db.from('boleta_materia').upsert([payload])
  if (error) throw new Error(error.message)
  return payload
}

export async function listarMaestros() {
  const db = createBoletasDb()
  const { data, error } = await db
    .from('boleta_maestro')
    .select(
      'maestro_id, maestro_app, maestro_apm, maestro_nombre, maestro_usuario, maestro_email, maestro_sexo'
    )
    .order('maestro_app')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertMaestro(row: {
  maestro_id?: number
  maestro_app?: string
  maestro_apm?: string
  maestro_nombre?: string
  maestro_usuario: string
  maestro_clave?: string
  maestro_email?: string
  maestro_sexo?: number
}) {
  const db = createBoletasDb()
  let id = row.maestro_id
  if (!id) {
    const { data: maxRows } = await db
      .from('boleta_maestro')
      .select('maestro_id')
      .order('maestro_id', { ascending: false })
      .limit(1)
    id = Number(maxRows?.[0]?.maestro_id ?? 0) + 1
  }
  const payload: Record<string, unknown> = {
    maestro_id: id,
    maestro_app: row.maestro_app ?? null,
    maestro_apm: row.maestro_apm ?? null,
    maestro_nombre: row.maestro_nombre ?? null,
    maestro_usuario: row.maestro_usuario.trim(),
    maestro_email: row.maestro_email ?? null,
    maestro_sexo: row.maestro_sexo ?? 0,
  }
  if (row.maestro_clave != null && String(row.maestro_clave).length > 0) {
    payload.maestro_clave = row.maestro_clave
  }
  const { error } = await db.from('boleta_maestro').upsert([payload])
  if (error) throw new Error(error.message)
  return payload
}

export async function listarAsignacionesGrupos() {
  const db = createBoletasDb()
  const { data, error } = await db
    .from('boleta_maestro_grupo')
    .select('grupo_id, maestro_id, materia_id, grupo_letra')
    .order('grupo_id')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertAsignacionGrupo(row: {
  grupo_id?: number
  maestro_id: number
  materia_id: number
  grupo_letra: string
}) {
  const db = createBoletasDb()
  let id = row.grupo_id
  if (!id) {
    const { data: maxRows } = await db
      .from('boleta_maestro_grupo')
      .select('grupo_id')
      .order('grupo_id', { ascending: false })
      .limit(1)
    id = Number(maxRows?.[0]?.grupo_id ?? 0) + 1
  }
  const payload = {
    grupo_id: id,
    maestro_id: Number(row.maestro_id),
    materia_id: Number(row.materia_id),
    grupo_letra: String(row.grupo_letra || 'ABC').toUpperCase(),
  }
  const { error } = await db.from('boleta_maestro_grupo').upsert([payload])
  if (error) throw new Error(error.message)
  return payload
}

export async function eliminarAsignacionGrupo(grupoId: number) {
  const db = createBoletasDb()
  const { error } = await db.from('boleta_maestro_grupo').delete().eq('grupo_id', grupoId)
  if (error) throw new Error(error.message)
}

export type ProgresoCaptura = {
  materia_id: number
  materia_nombre: string
  materia_grado: number
  grupo_letra: string
  capturados: number
  esperados: number
  pct: number
}

export async function progresoCaptura(ciclo: number, periodo: number): Promise<ProgresoCaptura[]> {
  const db = createBoletasDb()
  const { data: asignaciones, error } = await db
    .from('boleta_maestro_grupo')
    .select('materia_id, grupo_letra')
  if (error) throw new Error(error.message)

  const { data: materias } = await db
    .from('boleta_materia')
    .select('materia_id, materia_nombre, materia_grado, materia_nivel')
    .eq('materia_nivel', BOLETAS_NIVEL_SECUNDARIA)

  const matMap = new Map((materias ?? []).map((m) => [Number(m.materia_id), m]))
  const out: ProgresoCaptura[] = []

  for (const a of asignaciones ?? []) {
    const mat = matMap.get(Number(a.materia_id))
    if (!mat) continue
    const grado = Number(mat.materia_grado)
    const { data: alumnos } = await db
      .from('alumno')
      .select('alumno_id, alumno_grupo')
      .eq('alumno_nivel', BOLETAS_NIVEL_SECUNDARIA)
      .eq('alumno_grado', grado)
      .eq('alumno_ciclo_escolar', ciclo)
      .eq('alumno_status', 1)

    const ids = (alumnos ?? [])
      .filter((al) => grupoCoincide(String(a.grupo_letra), Number(al.alumno_grupo)))
      .map((al) => Number(al.alumno_id))

    let capturados = 0
    if (ids.length) {
      const { data: cals } = await db
        .from('boleta_calificacion')
        .select('alumno_id, calificacion_puntos')
        .eq('materia_id', Number(a.materia_id))
        .eq('calificacion_bimestre', periodo)
        .eq('calificacion_ciclo_escolar', ciclo)
        .in('alumno_id', ids)
      capturados = (cals ?? []).filter((c) => {
        const v = String(c.calificacion_puntos ?? '').trim()
        return v && v !== '-'
      }).length
    }

    const esperados = ids.length
    out.push({
      materia_id: Number(a.materia_id),
      materia_nombre: String(mat.materia_nombre),
      materia_grado: grado,
      grupo_letra: String(a.grupo_letra ?? ''),
      capturados,
      esperados,
      pct: esperados ? Math.round((capturados / esperados) * 100) : 0,
    })
  }

  return out.sort((x, y) => x.materia_grado - y.materia_grado || x.materia_nombre.localeCompare(y.materia_nombre))
}

export { MATERIA_IDS_MINDFULNESS }
