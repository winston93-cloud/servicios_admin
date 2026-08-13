import { createBoletasDb } from './boletasInsforge'
import {
  BOLETAS_NIVEL_SECUNDARIA,
  grupoCoincide,
  letraDesdeGrupoNum,
} from './boletasCiclo'
import type { BoletasSession } from './boletasAuth'

export type AlumnoCaptura = {
  alumno_id: number
  alumno_ref: number | null
  nombre: string
  alumno_grado: number
  alumno_grupo: number
  grupo_letra: string
  calificacion: string | null
  inasistencia: number
  conducta: string | null
  comprension: string | null
}

export type AsignacionMaestro = {
  grupo_id: number
  materia_id: number
  materia_nombre: string
  materia_grado: number
  grupo_letra: string
}

export async function listarAsignacionesMaestro(maestroId: number): Promise<AsignacionMaestro[]> {
  const db = createBoletasDb()
  const { data: grupos, error } = await db
    .from('boleta_maestro_grupo')
    .select('grupo_id, maestro_id, materia_id, grupo_letra')
    .eq('maestro_id', maestroId)

  if (error) throw new Error(error.message)
  const materiaIds = [...new Set((grupos ?? []).map((g) => Number(g.materia_id)))]
  if (!materiaIds.length) return []

  const { data: materias, error: errM } = await db
    .from('boleta_materia')
    .select('materia_id, materia_nombre, materia_grado, materia_nivel')
    .in('materia_id', materiaIds)

  if (errM) throw new Error(errM.message)
  const mapa = new Map((materias ?? []).map((m) => [Number(m.materia_id), m]))

  return (grupos ?? [])
    .map((g) => {
      const m = mapa.get(Number(g.materia_id))
      if (!m || Number(m.materia_nivel) !== BOLETAS_NIVEL_SECUNDARIA) return null
      return {
        grupo_id: Number(g.grupo_id),
        materia_id: Number(g.materia_id),
        materia_nombre: String(m.materia_nombre ?? ''),
        materia_grado: Number(m.materia_grado),
        grupo_letra: String(g.grupo_letra ?? ''),
      }
    })
    .filter(Boolean) as AsignacionMaestro[]
}

export async function obtenerBimestreActivo(): Promise<{ bimestre_id: number; bimestre_activo: number; bimestre_etiqueta: string | null }> {
  const db = createBoletasDb()
  const { data, error } = await db
    .from('boleta_bimestre')
    .select('bimestre_id, bimestre_activo, bimestre_etiqueta')
    .eq('bimestre_id', 1)
    .limit(1)

  if (error) throw new Error(error.message)
  const row = data?.[0]
  return {
    bimestre_id: 1,
    bimestre_activo: Number(row?.bimestre_activo ?? 1),
    bimestre_etiqueta: row?.bimestre_etiqueta != null ? String(row.bimestre_etiqueta) : 'Periodo activo',
  }
}

export async function setBimestreActivo(periodo: number, etiqueta?: string): Promise<void> {
  const db = createBoletasDb()
  const { error } = await db.from('boleta_bimestre').upsert([
    {
      bimestre_id: 1,
      bimestre_activo: periodo,
      bimestre_etiqueta: etiqueta ?? `Periodo ${periodo}`,
    },
  ])
  if (error) throw new Error(error.message)
}

export async function listarAlumnosCaptura(input: {
  materiaId: number
  grupoLetra: string
  periodo: number
  ciclo: number
}): Promise<AlumnoCaptura[]> {
  const db = createBoletasDb()
  const { data: materia, error: errMat } = await db
    .from('boleta_materia')
    .select('materia_id, materia_grado, materia_nivel')
    .eq('materia_id', input.materiaId)
    .limit(1)

  if (errMat) throw new Error(errMat.message)
  const mat = materia?.[0]
  if (!mat) throw new Error('Materia no encontrada')

  const { data: alumnos, error } = await db
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo, alumno_nivel, alumno_status, alumno_ciclo_escolar'
    )
    .eq('alumno_nivel', BOLETAS_NIVEL_SECUNDARIA)
    .eq('alumno_grado', Number(mat.materia_grado))
    .eq('alumno_ciclo_escolar', input.ciclo)
    .eq('alumno_status', 1)
    .order('alumno_app')

  if (error) throw new Error(error.message)

  const filtrados = (alumnos ?? []).filter((a) =>
    grupoCoincide(input.grupoLetra, Number(a.alumno_grupo))
  )
  const ids = filtrados.map((a) => Number(a.alumno_id))
  if (!ids.length) return []

  const [{ data: cals }, { data: inas }, { data: conds }, { data: comps }] = await Promise.all([
    db
      .from('boleta_calificacion')
      .select('alumno_id, calificacion_puntos')
      .eq('materia_id', input.materiaId)
      .eq('calificacion_bimestre', input.periodo)
      .eq('calificacion_ciclo_escolar', input.ciclo)
      .in('alumno_id', ids),
    db
      .from('boleta_inasistencia')
      .select('alumno_id, inasistencia_cantidad')
      .eq('materia_id', input.materiaId)
      .eq('inasistencia_bimestre', input.periodo)
      .eq('inasistencia_ciclo_escolar', input.ciclo)
      .in('alumno_id', ids),
    db
      .from('boleta_conducta')
      .select('alumno_id, conducta_valor')
      .eq('materia_id', input.materiaId)
      .eq('conducta_bimestre', input.periodo)
      .eq('conducta_ciclo_escolar', input.ciclo)
      .in('alumno_id', ids),
    db
      .from('boleta_comprension_lectora')
      .select('alumno_id, comprension_valor')
      .eq('comprension_trimestre', input.periodo)
      .eq('comprension_ciclo_escolar', input.ciclo)
      .in('alumno_id', ids),
  ])

  const mapCal = new Map((cals ?? []).map((r) => [Number(r.alumno_id), r.calificacion_puntos != null ? String(r.calificacion_puntos) : null]))
  const mapIna = new Map((inas ?? []).map((r) => [Number(r.alumno_id), Number(r.inasistencia_cantidad ?? 0)]))
  const mapCon = new Map((conds ?? []).map((r) => [Number(r.alumno_id), r.conducta_valor != null ? String(r.conducta_valor) : null]))
  const mapComp = new Map((comps ?? []).map((r) => [Number(r.alumno_id), r.comprension_valor != null ? String(r.comprension_valor) : null]))

  return filtrados.map((a) => {
    const id = Number(a.alumno_id)
    const grupo = Number(a.alumno_grupo)
    return {
      alumno_id: id,
      alumno_ref: a.alumno_ref != null ? Number(a.alumno_ref) : null,
      nombre: [a.alumno_app, a.alumno_apm, a.alumno_nombre].map((x) => String(x ?? '').trim()).filter(Boolean).join(' '),
      alumno_grado: Number(a.alumno_grado),
      alumno_grupo: grupo,
      grupo_letra: letraDesdeGrupoNum(grupo),
      calificacion: mapCal.get(id) ?? null,
      inasistencia: mapIna.get(id) ?? 0,
      conducta: mapCon.get(id) ?? null,
      comprension: mapComp.get(id) ?? null,
    }
  })
}

export type CapturaFilaSave = {
  alumno_id: number
  calificacion?: string | null
  inasistencia?: number | null
  conducta?: string | null
  comprension?: string | null
}

export async function guardarCaptura(input: {
  session: BoletasSession
  materiaId: number
  periodo: number
  ciclo: number
  filas: CapturaFilaSave[]
}): Promise<{ saved: number }> {
  if (input.session.role === 'maestro') {
    const asigs = await listarAsignacionesMaestro(input.session.id)
    if (!asigs.some((a) => a.materia_id === input.materiaId)) {
      throw new Error('Materia no asignada a este maestro')
    }
  }

  const db = createBoletasDb()
  let saved = 0

  for (const fila of input.filas) {
    const alumnoId = Number(fila.alumno_id)
    if (!alumnoId) continue

    if (fila.calificacion !== undefined) {
      const puntos = fila.calificacion == null || String(fila.calificacion).trim() === ''
        ? null
        : String(fila.calificacion).trim()
      const { data: existing } = await db
        .from('boleta_calificacion')
        .select('calificacion_id')
        .eq('alumno_id', alumnoId)
        .eq('materia_id', input.materiaId)
        .eq('calificacion_bimestre', input.periodo)
        .eq('calificacion_ciclo_escolar', input.ciclo)
        .limit(1)

      if (existing?.[0]) {
        const { error } = await db
          .from('boleta_calificacion')
          .update({ calificacion_puntos: puntos })
          .eq('calificacion_id', existing[0].calificacion_id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await db.from('boleta_calificacion').insert([
          {
            alumno_id: alumnoId,
            materia_id: input.materiaId,
            calificacion_bimestre: input.periodo,
            calificacion_ciclo_escolar: input.ciclo,
            calificacion_puntos: puntos,
          },
        ])
        if (error) throw new Error(error.message)
      }
      saved++
    }

    if (fila.inasistencia !== undefined && fila.inasistencia !== null) {
      const cant = Math.max(0, Number(fila.inasistencia) || 0)
      const { data: existing } = await db
        .from('boleta_inasistencia')
        .select('inasistencia_id')
        .eq('alumno_id', alumnoId)
        .eq('materia_id', input.materiaId)
        .eq('inasistencia_bimestre', input.periodo)
        .eq('inasistencia_ciclo_escolar', input.ciclo)
        .limit(1)

      if (existing?.[0]) {
        const { error } = await db
          .from('boleta_inasistencia')
          .update({ inasistencia_cantidad: cant })
          .eq('inasistencia_id', existing[0].inasistencia_id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await db.from('boleta_inasistencia').insert([
          {
            alumno_id: alumnoId,
            materia_id: input.materiaId,
            inasistencia_bimestre: input.periodo,
            inasistencia_ciclo_escolar: input.ciclo,
            inasistencia_cantidad: cant,
          },
        ])
        if (error) throw new Error(error.message)
      }
      saved++
    }

    if (fila.conducta !== undefined) {
      const valor = fila.conducta == null || String(fila.conducta).trim() === ''
        ? null
        : String(fila.conducta).trim()
      const { data: existing } = await db
        .from('boleta_conducta')
        .select('conducta_id')
        .eq('alumno_id', alumnoId)
        .eq('materia_id', input.materiaId)
        .eq('conducta_bimestre', input.periodo)
        .eq('conducta_ciclo_escolar', input.ciclo)
        .limit(1)

      if (existing?.[0]) {
        const { error } = await db
          .from('boleta_conducta')
          .update({ conducta_valor: valor })
          .eq('conducta_id', existing[0].conducta_id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await db.from('boleta_conducta').insert([
          {
            alumno_id: alumnoId,
            materia_id: input.materiaId,
            conducta_bimestre: input.periodo,
            conducta_ciclo_escolar: input.ciclo,
            conducta_valor: valor,
          },
        ])
        if (error) throw new Error(error.message)
      }
      saved++
    }

    if (fila.comprension !== undefined) {
      const valor = fila.comprension == null || String(fila.comprension).trim() === ''
        ? null
        : String(fila.comprension).trim()
      const { data: existing } = await db
        .from('boleta_comprension_lectora')
        .select('comprension_id')
        .eq('alumno_id', alumnoId)
        .eq('comprension_trimestre', input.periodo)
        .eq('comprension_ciclo_escolar', input.ciclo)
        .limit(1)

      if (existing?.[0]) {
        const { error } = await db
          .from('boleta_comprension_lectora')
          .update({ comprension_valor: valor })
          .eq('comprension_id', existing[0].comprension_id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await db.from('boleta_comprension_lectora').insert([
          {
            alumno_id: alumnoId,
            comprension_trimestre: input.periodo,
            comprension_ciclo_escolar: input.ciclo,
            comprension_valor: valor,
          },
        ])
        if (error) throw new Error(error.message)
      }
      saved++
    }
  }

  return { saved }
}
