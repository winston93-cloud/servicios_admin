import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  COLORES_TALLER,
  DIAS_EDITABLES_ASISTENCIA,
  etiquetaGradoAlumno,
  lugarDeHorario,
  minutosDeHora,
  nombreMaestroTaller,
  type AlumnoAsistencia,
  type AsistenciaDia,
  type RegistroAsistencia,
  type SesionAsistencia,
} from '@/lib/talleres/talleresTypes'
import { TalleresError, snapshotTalleres } from '@/lib/talleres/talleresService'

const ZONA = 'America/Mexico_City'

function db() {
  return createDbAdmin()
}

function fail(error: { message?: string } | null, contexto: string): void {
  if (error) throw new TalleresError(`${contexto}: ${error.message ?? 'error de base de datos'}`, 500)
}

export function hoyMexico(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date())
}

function diaSemana(fecha: string): number {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay()
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86_400_000)
}

function fechaValida(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T12:00:00Z`))) {
    throw new TalleresError('Fecha inválida.')
  }
  return s
}

function esEditable(fecha: string, hoy: string): boolean {
  const d = diasEntre(fecha, hoy)
  return d >= 0 && d <= DIAS_EDITABLES_ASISTENCIA
}

async function alumnosDeGrupos(asignacionIds: number[]): Promise<Map<number, AlumnoAsistencia[]>> {
  const out = new Map<number, AlumnoAsistencia[]>()
  if (!asignacionIds.length) return out
  const { data: ins, error } = await db()
    .from('taller_inscripcion')
    .select('asignacion_id, alumno_id')
    .in('asignacion_id', asignacionIds)
    .eq('estado', 'inscrito')
  fail(error, 'Inscripciones')
  const filas = (ins ?? []) as { asignacion_id: number; alumno_id: number }[]
  const ids = [...new Set(filas.map((f) => Number(f.alumno_id)))]
  const alumnos = new Map<number, AlumnoAsistencia>()
  if (ids.length) {
    const { data, error: aErr } = await db()
      .from('alumno')
      .select('alumno_id, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo')
      .in('alumno_id', ids)
    fail(aErr, 'Alumnos')
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      const nivel = Number(r.alumno_nivel) || 0
      const nombre = [r.alumno_nombre, r.alumno_app, r.alumno_apm]
        .map((x) => String(x ?? '').trim())
        .filter(Boolean)
        .join(' ')
      alumnos.set(Number(r.alumno_id), {
        alumno_id: Number(r.alumno_id),
        nombre: nombre || `Alumno ${r.alumno_id}`,
        nivel,
        grado: etiquetaGradoAlumno({
          nivel,
          grado: r.alumno_grado == null ? null : Number(r.alumno_grado),
          grupo: r.alumno_grupo == null ? null : Number(r.alumno_grupo),
        }),
      })
    }
  }
  for (const f of filas) {
    const a = alumnos.get(Number(f.alumno_id))
    if (!a) continue
    const aid = Number(f.asignacion_id)
    const lista = out.get(aid) ?? []
    lista.push(a)
    out.set(aid, lista)
  }
  for (const lista of out.values()) lista.sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))
  return out
}

async function registrosDelDia(fecha: string, asignacionIds: number[]): Promise<Map<number, RegistroAsistencia>> {
  const out = new Map<number, RegistroAsistencia>()
  if (!asignacionIds.length) return out
  const { data, error } = await db()
    .from('taller_asistencia')
    .select('asignacion_id, total_alumnos, faltas, registrado_por, updated_at')
    .eq('fecha', fecha)
    .in('asignacion_id', asignacionIds)
  fail(error, 'Asistencia')
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    out.set(Number(r.asignacion_id), {
      total_alumnos: r.total_alumnos == null ? null : Number(r.total_alumnos),
      faltas: Array.isArray(r.faltas) ? (r.faltas as unknown[]).map(Number) : [],
      registrado_por: (r.registrado_por as string | null) ?? null,
      updated_at: String(r.updated_at ?? ''),
    })
  }
  return out
}

export async function asistenciaDelDia(rawFecha: unknown): Promise<AsistenciaDia> {
  const hoy = hoyMexico()
  const fecha = rawFecha ? fechaValida(rawFecha) : hoy
  const dia = diaSemana(fecha)
  const snap = await snapshotTalleres()
  const tallerPorId = new Map(snap.talleres.map((t) => [t.id, t]))
  const maestroPorId = new Map(snap.maestros.map((m) => [m.id, m]))

  const delDia = snap.asignaciones.flatMap((a) =>
    a.horarios.filter((h) => h.dia === dia).map((h) => ({ a, h }))
  )
  const ids = [...new Set(delDia.map((x) => x.a.id))]
  const [alumnos, registros] = await Promise.all([alumnosDeGrupos(ids), registrosDelDia(fecha, ids)])

  const sesiones: SesionAsistencia[] = delDia
    .map(({ a, h }) => {
      const t = tallerPorId.get(a.taller_id)
      const m = maestroPorId.get(a.maestro_id)
      return {
        asignacion_id: a.id,
        taller: t?.nombre ?? 'Taller',
        grados: t?.grados ?? null,
        color: t?.color ?? COLORES_TALLER[0],
        maestro: m ? nombreMaestroTaller(m) : 'Sin maestro',
        niveles: a.niveles,
        hora_inicio: h.hora_inicio,
        hora_fin: h.hora_fin,
        lugar: lugarDeHorario(a, h),
        alumnos: alumnos.get(a.id) ?? [],
        registro: registros.get(a.id) ?? null,
      }
    })
    .sort(
      (x, y) =>
        minutosDeHora(x.hora_inicio) - minutosDeHora(y.hora_inicio) ||
        x.taller.localeCompare(y.taller, 'es')
    )

  return { ciclo: snap.ciclo, fecha, hoy, dia, editable: esEditable(fecha, hoy), sesiones }
}

export async function guardarAsistencia(body: Record<string, unknown>): Promise<RegistroAsistencia> {
  const hoy = hoyMexico()
  const fecha = fechaValida(body.fecha)
  if (!esEditable(fecha, hoy)) {
    throw new TalleresError(
      `Solo se puede registrar asistencia de hoy o de los últimos ${DIAS_EDITABLES_ASISTENCIA} días.`
    )
  }
  const asignacionId = Number(body.asignacion_id) || 0
  const snap = await snapshotTalleres()
  const asignacion = snap.asignaciones.find((a) => a.id === asignacionId)
  if (!asignacion) throw new TalleresError('El taller no existe o no es del ciclo actual.', 404)
  if (!asignacion.horarios.some((h) => h.dia === diaSemana(fecha))) {
    throw new TalleresError('Ese taller no tiene clase en la fecha elegida.')
  }

  const inscritos = new Set(((await alumnosDeGrupos([asignacionId])).get(asignacionId) ?? []).map((a) => a.alumno_id))
  const faltas = Array.isArray(body.faltas)
    ? [...new Set((body.faltas as unknown[]).map(Number))].filter((id) => inscritos.has(id))
    : []

  let total: number | null = null
  if (body.total_alumnos !== null && body.total_alumnos !== undefined && body.total_alumnos !== '') {
    total = Number(body.total_alumnos)
    if (!Number.isInteger(total) || total < 0 || total > 500) {
      throw new TalleresError('El total de alumnos debe ser un número entre 0 y 500.')
    }
  }

  const registradoPor = String(body.registrado_por ?? '').trim().slice(0, 80) || null
  const updated_at = new Date().toISOString()
  const { error } = await db()
    .from('taller_asistencia')
    .upsert(
      [{ asignacion_id: asignacionId, fecha, total_alumnos: total, faltas, registrado_por: registradoPor, updated_at }],
      { onConflict: 'asignacion_id,fecha' }
    )
  fail(error, 'Guardar asistencia')
  return { total_alumnos: total, faltas, registrado_por: registradoPor, updated_at }
}
