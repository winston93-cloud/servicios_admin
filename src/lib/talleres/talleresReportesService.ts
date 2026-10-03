import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  COLORES_TALLER,
  MAX_DIAS_REPORTE,
  NIVELES_TALLER,
  minutosDeHora,
  minutosIncidencia,
  nombreMaestroTaller,
  nombreTallerCompleto,
  type GrupoHoras,
  type MaestroHoras,
  type ReporteHorasMaestros,
} from '@/lib/talleres/talleresTypes'
import { TalleresError, asignacionesPorIds, snapshotTalleres, todasLasFilas } from '@/lib/talleres/talleresService'
import { SELECT_INCIDENCIA, fechaValida, mapIncidencia } from '@/lib/talleres/talleresAsistenciaService'

function fecha(raw: unknown, campo: string): string {
  try {
    return fechaValida(raw)
  } catch {
    throw new TalleresError(`Fecha «${campo}» inválida.`)
  }
}

const hhmm = (v: unknown) => (v ? String(v).slice(0, 5) : null)

function diaSemana(f: string): number {
  return new Date(`${f}T12:00:00Z`).getUTCDay()
}

/**
 * Horas impartidas por maestro en un nivel y rango de fechas.
 * Cuentan los días con asistencia o con horario del maestro registrado. Maestro y duración salen de la copia
 * guardada en cada registro (filas antiguas sin copia: horario actual del grupo).
 * Incluye grupos de otros ciclos o dados de baja si tienen registros en el rango.
 * Si el maestro no asistió, esa clase no suma. Llegadas tarde / salidas anticipadas son informativas.
 */
export async function reporteHorasMaestros(params: {
  nivel: unknown
  desde: unknown
  hasta: unknown
}): Promise<ReporteHorasMaestros> {
  const nivel = Number(params.nivel)
  if (!NIVELES_TALLER.some((n) => n.valor === nivel)) throw new TalleresError('Selecciona el nivel.')
  const desde = fecha(params.desde, 'desde')
  const hasta = fecha(params.hasta, 'hasta')
  if (hasta < desde) throw new TalleresError('La fecha final es anterior a la inicial.')
  const dias = Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86_400_000)
  if (dias > MAX_DIAS_REPORTE) throw new TalleresError(`El periodo no puede pasar de ${MAX_DIAS_REPORTE} días.`)

  const filas = await todasLasFilas<Record<string, unknown>>(
    (d, h) =>
      createDbAdmin()
        .from('taller_asistencia')
        .select(
          `id, asignacion_id, fecha, total_alumnos, maestro_id, hora_inicio, hora_fin, minutos_programados, ${SELECT_INCIDENCIA}`
        )
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('fecha', { ascending: true })
        .order('id', { ascending: true })
        .range(d, h),
    'Asistencia'
  )
  const [snap, todasAsignaciones] = await Promise.all([
    snapshotTalleres(),
    asignacionesPorIds([...new Set(filas.map((r) => Number(r.asignacion_id)))]),
  ])
  const asignaciones = todasAsignaciones.filter((a) => a.niveles.includes(nivel))
  const base = { ciclo: snap.ciclo, nivel, desde, hasta }
  if (!asignaciones.length) {
    return {
      ...base,
      maestros: [],
      total_minutos: 0,
      total_sesiones: 0,
      sin_horario: 0,
      total_incidencias: 0,
      total_minutos_no_impartidos: 0,
      total_faltas_maestro: 0,
    }
  }

  const tPorId = new Map(snap.talleres.map((t) => [t.id, t]))
  const mPorId = new Map(snap.maestros.map((m) => [m.id, m]))
  const aPorId = new Map(asignaciones.map((a) => [a.id, a]))
  const grupos = new Map<string, GrupoHoras>()
  let sinHorario = 0

  for (const r of filas) {
    const a = aPorId.get(Number(r.asignacion_id))
    if (!a) continue
    const f = String(r.fecha).slice(0, 10)
    const dia = diaSemana(f)
    let inicio = hhmm(r.hora_inicio)
    let fin = hhmm(r.hora_fin)
    let programados = r.minutos_programados == null ? null : Number(r.minutos_programados)
    if (programados == null) {
      const delDia = a.horarios
        .filter((h) => h.dia === dia)
        .sort((x, y) => minutosDeHora(x.hora_inicio) - minutosDeHora(y.hora_inicio))
      inicio = delDia[0]?.hora_inicio ?? null
      fin = delDia.at(-1)?.hora_fin ?? null
      programados = delDia.length
        ? delDia.reduce((s, h) => s + Math.max(0, minutosDeHora(h.hora_fin) - minutosDeHora(h.hora_inicio)), 0)
        : null
    }
    const incidencia = mapIncidencia(r)
    const minutos = incidencia?.falto || programados == null ? 0 : programados
    if (programados == null) sinHorario++
    const perdidos = inicio && fin && !incidencia?.falto
      ? minutosIncidencia(inicio, fin, incidencia)
      : { tarde: 0, antes: 0 }
    const maestroId = r.maestro_id == null ? a.maestro_id : Number(r.maestro_id)
    const clave = `${a.id}:${maestroId}`
    let g = grupos.get(clave)
    if (!g) {
      const t = tPorId.get(a.taller_id)
      g = {
        asignacion_id: a.id,
        maestro_id: maestroId,
        taller: t ? nombreTallerCompleto(t) : 'Taller eliminado',
        color: t?.color ?? COLORES_TALLER[0],
        niveles: a.niveles,
        minutos: 0,
        sesiones: [],
      }
      grupos.set(clave, g)
    }
    g.minutos += minutos
    g.sesiones.push({
      fecha: f,
      dia,
      hora_inicio: inicio,
      hora_fin: fin,
      minutos,
      alumnos: r.total_alumnos == null ? null : Number(r.total_alumnos),
      incidencia,
      minutos_no_impartidos: perdidos.tarde + perdidos.antes,
    })
  }

  const maestros = new Map<number, MaestroHoras>()
  for (const g of grupos.values()) {
    let m = maestros.get(g.maestro_id)
    if (!m) {
      const mm = mPorId.get(g.maestro_id)
      m = {
        maestro_id: g.maestro_id,
        nombre: mm ? nombreMaestroTaller(mm) : 'Maestro eliminado',
        minutos: 0,
        sesiones: 0,
        dias: [],
        grupos: [],
        incidencias: 0,
        minutos_no_impartidos: 0,
        faltas_maestro: 0,
      }
      maestros.set(g.maestro_id, m)
    }
    m.minutos += g.minutos
    m.sesiones += g.sesiones.filter((ss) => ss.minutos > 0).length
    m.grupos.push(g)
    for (const ss of g.sesiones) {
      if (!ss.incidencia) continue
      if (ss.incidencia.falto) {
        m.faltas_maestro++
        continue
      }
      m.incidencias++
      m.minutos_no_impartidos += ss.minutos_no_impartidos
    }
  }
  for (const m of maestros.values()) {
    m.dias = [
      ...new Set(m.grupos.flatMap((g) => g.sesiones.filter((s) => s.minutos > 0).map((s) => s.fecha))),
    ].sort()
    m.grupos.sort((x, y) => x.taller.localeCompare(y.taller, 'es', { numeric: true }))
  }
  const lista = [...maestros.values()].sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))

  return {
    ...base,
    maestros: lista,
    total_minutos: lista.reduce((s, m) => s + m.minutos, 0),
    total_sesiones: lista.reduce((s, m) => s + m.sesiones, 0),
    sin_horario: sinHorario,
    total_incidencias: lista.reduce((s, m) => s + m.incidencias, 0),
    total_minutos_no_impartidos: lista.reduce((s, m) => s + m.minutos_no_impartidos, 0),
    total_faltas_maestro: lista.reduce((s, m) => s + m.faltas_maestro, 0),
  }
}
