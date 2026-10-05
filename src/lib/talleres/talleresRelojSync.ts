/**
 * 2026-10-05 — Talleres → reloj checador.
 * El reloj lee de aquí el catálogo (grupos, horarios, maestro ligado por número de empleado) y la
 * asistencia (pase de lista + incidencias del maestro) para generar y confirmar sus sesiones pagables.
 * Ambos lados comparten TALLERES_SYNC_SECRET.
 */
import { timingSafeEqual } from 'crypto'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { TalleresError, snapshotTalleres, todasLasFilas } from '@/lib/talleres/talleresService'
import { nombreMaestroTaller, nombreTallerCompleto, type InstitucionReloj } from '@/lib/talleres/talleresTypes'
import { fechaValida } from '@/lib/talleres/talleresAsistenciaService'

const RELOJ_SYNC_URL_DEFAULT = 'https://reloj-checador-ruddy.vercel.app/api/workshops/sync-servicios'
const MAX_DIAS_EXPORT = 62

export function secretoSyncValido(request: Request): boolean {
  const secreto = process.env.TALLERES_SYNC_SECRET?.trim()
  if (!secreto) return false
  const a = Buffer.from(request.headers.get('authorization') ?? '')
  const b = Buffer.from(`Bearer ${secreto}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

export type ExportTalleresReloj = {
  ciclo: { valor: number; nombre: string }
  desde: string
  hasta: string
  maestros: {
    id: number
    nombre: string
    numero_empleado: string | null
    institucion_reloj: InstitucionReloj | null
    activo: boolean
  }[]
  grupos: {
    id: number
    nombre: string
    maestro_id: number
    niveles: number[]
    cupo: number | null
    cupo_min: number | null
    inscritos: number
    activo: boolean
    horarios: { dia: number; hora_inicio: string; hora_fin: string }[]
  }[]
  asistencias: {
    asignacion_id: number
    fecha: string
    lista_pasada: boolean
    total_alumnos: number | null
    maestro_falto: boolean
    maestro_id: number | null
    hora_inicio: string | null
    hora_fin: string | null
    minutos_programados: number | null
    llegada_maestro: string | null
    salida_maestro: string | null
    incidencia_motivo: string | null
    incidencia_nota: string | null
    registrado_por: string | null
    incidencia_por: string | null
  }[]
}

const hhmm = (v: unknown) => (v ? String(v).slice(0, 5) : null)

export async function exportarParaReloj(rawDesde: unknown, rawHasta: unknown): Promise<ExportTalleresReloj> {
  const desde = fechaValida(rawDesde)
  const hasta = fechaValida(rawHasta)
  const dias = (Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86_400_000
  if (dias < 0 || dias > MAX_DIAS_EXPORT) {
    throw new TalleresError(`El rango debe ir de 0 a ${MAX_DIAS_EXPORT} días.`)
  }
  const snap = await snapshotTalleres()
  const talleres = new Map(snap.talleres.map((t) => [t.id, t]))
  const filas = await todasLasFilas<Record<string, unknown>>(
    (d, h) =>
      createDbAdmin()
        .from('taller_asistencia')
        .select(
          'id, asignacion_id, fecha, lista_pasada, total_alumnos, maestro_falto, maestro_id, hora_inicio, hora_fin, minutos_programados, llegada_maestro, salida_maestro, incidencia_motivo, incidencia_nota, registrado_por, incidencia_por'
        )
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('id')
        .range(d, h),
    'Asistencia para el reloj'
  )
  return {
    ciclo: snap.ciclo,
    desde,
    hasta,
    maestros: snap.maestros.map((m) => ({
      id: m.id,
      nombre: nombreMaestroTaller(m),
      numero_empleado: m.numero_empleado,
      institucion_reloj: m.institucion_reloj,
      activo: m.activo,
    })),
    grupos: snap.asignaciones.map((a) => {
      const t = talleres.get(a.taller_id)
      return {
        id: a.id,
        nombre: t ? nombreTallerCompleto(t) : `Taller ${a.taller_id}`,
        maestro_id: a.maestro_id,
        niveles: a.niveles.length ? a.niveles : (t?.niveles ?? []),
        cupo: a.cupo,
        cupo_min: a.cupo_min,
        inscritos: a.inscritos,
        activo: a.activo && (t?.activo ?? true),
        horarios: a.horarios.map((h) => ({ dia: h.dia, hora_inicio: h.hora_inicio, hora_fin: h.hora_fin })),
      }
    }),
    asistencias: filas.map((r) => ({
      asignacion_id: Number(r.asignacion_id),
      fecha: String(r.fecha).slice(0, 10),
      lista_pasada: r.lista_pasada === true,
      total_alumnos: r.total_alumnos == null ? null : Number(r.total_alumnos),
      maestro_falto: r.maestro_falto === true,
      maestro_id: r.maestro_id == null ? null : Number(r.maestro_id),
      hora_inicio: hhmm(r.hora_inicio),
      hora_fin: hhmm(r.hora_fin),
      minutos_programados: r.minutos_programados == null ? null : Number(r.minutos_programados),
      llegada_maestro: hhmm(r.llegada_maestro),
      salida_maestro: hhmm(r.salida_maestro),
      incidencia_motivo: (r.incidencia_motivo as string | null) ?? null,
      incidencia_nota: (r.incidencia_nota as string | null) ?? null,
      registrado_por: (r.registrado_por as string | null) ?? null,
      incidencia_por: (r.incidencia_por as string | null) ?? null,
    })),
  }
}

/** Pide al reloj que vuelva a leer (el día indicado o todo el periodo). Nunca lanza: el reloj también sincroniza a diario. */
export async function avisarReloj(fecha?: string): Promise<void> {
  const secreto = process.env.TALLERES_SYNC_SECRET?.trim()
  if (!secreto) return
  try {
    const res = await fetch(process.env.RELOJ_TALLERES_SYNC_URL?.trim() || RELOJ_SYNC_URL_DEFAULT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secreto}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(fecha ? { fecha } : {}),
      signal: AbortSignal.timeout(55_000),
    })
    if (!res.ok) console.error('Aviso al reloj (talleres):', res.status)
  } catch (e) {
    console.error('Aviso al reloj (talleres):', e)
  }
}
