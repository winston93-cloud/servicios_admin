import { createDbAdmin } from '@/lib/insforgeAdmin'
import { publicarPlanClassroom, retirarPlanClassroom } from './teClassroom'
import { TeError, equipo } from './teService'
import { bloquesDePlan, normalizarPlan, type TeNivel, type TePlanClassroom } from './teTypes'

/** Publica (programado 7:00) o retira de Classroom la planeación; guarda qué se creó para no duplicar. */
export async function planeacionAClassroom(nivel: TeNivel, id: number, accion: 'publicar' | 'retirar', quien: string): Promise<TePlanClassroom> {
  const db = createDbAdmin()
  const { data: p, error } = await db
    .from('te_planeacion')
    .select('id, maestro_id, grado, semana, estado, contenido')
    .eq('id', id)
    .eq('nivel', nivel)
    .maybeSingle()
  if (error) throw new Error(`Planeación: ${error.message}`)
  if (!p) throw new TeError('Planeación no encontrada.', 404)
  if (accion === 'publicar' && p.estado !== 'aprobada') throw new TeError('Primero aprueba la planeación.')

  const t = (await equipo(nivel)).find((x) => x.maestro_id === Number(p.maestro_id))
  if (!t) throw new TeError('La teacher no pertenece a este equipo.', 404)
  if (!t.email) throw new TeError(`Falta el correo institucional de ${t.nombre} (Teachers → su perfil).`)

  const { data: previasRaw, error: gErr } = await db.from('te_planeacion_gclass').select('course_id, item_id, fecha').eq('planeacion_id', id)
  if (gErr) throw new Error(`Classroom: ${gErr.message}`)
  const previas = ((previasRaw ?? []) as Record<string, unknown>[]).map((x) => ({
    course_id: String(x.course_id),
    item_id: String(x.item_id),
    fecha: String(x.fecha).slice(0, 10),
  }))

  let r
  if (accion === 'publicar') {
    let contenido
    try {
      contenido = normalizarPlan(p.contenido)
    } catch {
      contenido = null
    }
    if (!contenido || !bloquesDePlan(contenido)) {
      throw new TeError('La planeación no tiene días ni actividades que publicar (si es PDF, léelo primero).')
    }
    r = await publicarPlanClassroom(t.email, {
      lunes: String(p.semana).slice(0, 10),
      grupos: t.grupos.filter((g) => Number(g[0]) === Number(p.grado)),
      contenido,
      previas,
    })
  } else {
    r = await retirarPlanClassroom(t.email, previas)
  }

  const conservar = new Set(r.conservadas.map((x) => x.item_id))
  const quitar = previas.filter((x) => !conservar.has(x.item_id)).map((x) => x.item_id)
  if (quitar.length) {
    const { error: dErr } = await db.from('te_planeacion_gclass').delete().eq('planeacion_id', id).in('item_id', quitar)
    if (dErr) console.error('te_planeacion_gclass delete:', dErr.message)
  }
  if (r.creadas.length) {
    const { error: iErr } = await db
      .from('te_planeacion_gclass')
      .insert(r.creadas.map((c) => ({ ...c, planeacion_id: id, maestro_id: Number(p.maestro_id) })))
    if (iErr) console.error('te_planeacion_gclass insert:', iErr.message)
  }

  const estado: TePlanClassroom = {
    at: new Date().toISOString(),
    por: quien,
    accion,
    clases: r.clases,
    programadas: r.programadas,
    inmediatas: r.inmediatas,
    publicadas_ya: r.publicadas_ya,
    retiradas: r.retiradas,
    omitidas: r.omitidas.slice(0, 30),
    errores: r.errores.slice(0, 20),
  }
  const { error: uErr } = await db.from('te_planeacion').update({ classroom: estado }).eq('id', id).eq('nivel', nivel)
  if (uErr) throw new Error(`Planeación: ${uErr.message}`)
  return estado
}
