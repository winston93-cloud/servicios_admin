import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  COLORES_TALLER,
  MAX_DIAS_REPORTE,
  NIVELES_TALLER,
  minutosDeHora,
  nombreMaestroTaller,
  nombreTallerCompleto,
  type GrupoHoras,
  type MaestroHoras,
  type ReporteHorasMaestros,
} from '@/lib/talleres/talleresTypes'
import { TalleresError, snapshotTalleres } from '@/lib/talleres/talleresService'

function fecha(raw: unknown, campo: string): string {
  const s = String(raw ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T12:00:00Z`))) {
    throw new TalleresError(`Fecha «${campo}» inválida.`)
  }
  return s
}

function diaSemana(f: string): number {
  return new Date(`${f}T12:00:00Z`).getUTCDay()
}

/**
 * Horas impartidas por maestro en un nivel y rango de fechas.
 * Solo cuentan los días con asistencia guardada; la duración sale del horario del grupo para ese día.
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

  const snap = await snapshotTalleres()
  const asignaciones = snap.asignaciones.filter((a) => a.niveles.includes(nivel))
  const base = { ciclo: snap.ciclo, nivel, desde, hasta }
  if (!asignaciones.length) {
    return { ...base, maestros: [], total_minutos: 0, total_sesiones: 0, sin_horario: 0 }
  }

  const { data, error } = await createDbAdmin()
    .from('taller_asistencia')
    .select('asignacion_id, fecha, total_alumnos')
    .in('asignacion_id', asignaciones.map((a) => a.id))
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
  if (error) throw new TalleresError(`Asistencia: ${error.message}`, 500)

  const tPorId = new Map(snap.talleres.map((t) => [t.id, t]))
  const mPorId = new Map(snap.maestros.map((m) => [m.id, m]))
  const aPorId = new Map(asignaciones.map((a) => [a.id, a]))
  const grupos = new Map<number, GrupoHoras>()
  let sinHorario = 0

  for (const r of (data ?? []) as { asignacion_id: number; fecha: string; total_alumnos: number | null }[]) {
    const a = aPorId.get(Number(r.asignacion_id))
    if (!a) continue
    const f = String(r.fecha).slice(0, 10)
    const dia = diaSemana(f)
    const delDia = a.horarios
      .filter((h) => h.dia === dia)
      .sort((x, y) => minutosDeHora(x.hora_inicio) - minutosDeHora(y.hora_inicio))
    const minutos = delDia.reduce(
      (s, h) => s + Math.max(0, minutosDeHora(h.hora_fin) - minutosDeHora(h.hora_inicio)),
      0
    )
    if (!delDia.length) sinHorario++
    let g = grupos.get(a.id)
    if (!g) {
      const t = tPorId.get(a.taller_id)
      g = {
        asignacion_id: a.id,
        taller: t ? nombreTallerCompleto(t) : 'Taller eliminado',
        color: t?.color ?? COLORES_TALLER[0],
        niveles: a.niveles,
        minutos: 0,
        sesiones: [],
      }
      grupos.set(a.id, g)
    }
    g.minutos += minutos
    g.sesiones.push({
      fecha: f,
      dia,
      hora_inicio: delDia[0]?.hora_inicio ?? null,
      hora_fin: delDia.at(-1)?.hora_fin ?? null,
      minutos,
      alumnos: r.total_alumnos == null ? null : Number(r.total_alumnos),
    })
  }

  const maestros = new Map<number, MaestroHoras>()
  for (const g of grupos.values()) {
    const a = aPorId.get(g.asignacion_id)!
    let m = maestros.get(a.maestro_id)
    if (!m) {
      const mm = mPorId.get(a.maestro_id)
      m = {
        maestro_id: a.maestro_id,
        nombre: mm ? nombreMaestroTaller(mm) : 'Maestro eliminado',
        minutos: 0,
        sesiones: 0,
        dias: [],
        grupos: [],
      }
      maestros.set(a.maestro_id, m)
    }
    m.minutos += g.minutos
    m.sesiones += g.sesiones.length
    m.grupos.push(g)
  }
  for (const m of maestros.values()) {
    m.dias = [...new Set(m.grupos.flatMap((g) => g.sesiones.map((s) => s.fecha)))].sort()
    m.grupos.sort((x, y) => x.taller.localeCompare(y.taller, 'es', { numeric: true }))
  }
  const lista = [...maestros.values()].sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))

  return {
    ...base,
    maestros: lista,
    total_minutos: lista.reduce((s, m) => s + m.minutos, 0),
    total_sesiones: lista.reduce((s, m) => s + m.sesiones, 0),
    sin_horario: sinHorario,
  }
}
