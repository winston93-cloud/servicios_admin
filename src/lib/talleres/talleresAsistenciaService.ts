import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  COLORES_TALLER,
  DIAS_EDITABLES_ASISTENCIA,
  etiquetaGradoAlumno,
  lugarDeHorario,
  minutosDeHora,
  nombreMaestroTaller,
  hora12,
  type AlumnoAsistencia,
  type AsistenciaDia,
  type IncidenciaMaestro,
  type RegistroAsistencia,
  type SesionAsistencia,
} from '@/lib/talleres/talleresTypes'
import {
  TalleresError,
  alumnosVigentes,
  filasPorIds,
  idEntero,
  snapshotTalleres,
} from '@/lib/talleres/talleresService'
import type { TallerAsignacion } from '@/lib/talleres/talleresTypes'

const ZONA = 'America/Mexico_City'

function fechaMx(iso: unknown): string | null {
  if (!iso) return null
  const d = new Date(String(iso))
  return Number.isNaN(d.getTime()) ? null : new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(d)
}

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

/** YYYY-MM-DD que exista en el calendario (rechaza 2026-02-30). */
export function fechaValida(raw: unknown): string {
  const s = String(raw ?? '').trim()
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00Z`) : null
  if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    throw new TalleresError('Fecha inválida.')
  }
  return s
}

/** Hoy y hasta DIAS_EDITABLES_ASISTENCIA atrás; los días futuros solo se consultan. */
function esEditable(fecha: string, hoy: string): boolean {
  const d = diasEntre(fecha, hoy)
  return d >= 0 && d <= DIAS_EDITABLES_ASISTENCIA
}

/**
 * Alumnos que estaban en cada grupo en `fecha` (alta ese día o antes y sin baja todavía),
 * excluyendo a quienes ya se dieron de baja del colegio.
 */
async function alumnosDeGrupos(asignacionIds: number[], fecha: string): Promise<Map<number, AlumnoAsistencia[]>> {
  const out = new Map<number, AlumnoAsistencia[]>()
  if (!asignacionIds.length) return out
  const todas = await filasPorIds<{
    asignacion_id: number
    alumno_id: number
    estado: string
    fecha_alta: string | null
    fecha_baja: string | null
  }>(
    asignacionIds,
    (trozo, d, h) =>
      db()
        .from('taller_inscripcion')
        .select('asignacion_id, alumno_id, estado, fecha_alta, fecha_baja')
        .in('asignacion_id', trozo)
        .order('id')
        .range(d, h),
    'Inscripciones'
  )
  const filas = todas.filter((f) => {
    const alta = fechaMx(f.fecha_alta)
    if (alta && alta > fecha) return false
    if (f.estado === 'inscrito') return true
    const baja = fechaMx(f.fecha_baja)
    return Boolean(baja && baja > fecha)
  })
  const vigentes = await alumnosVigentes(filas.map((f) => Number(f.alumno_id)))
  const ids = [...vigentes]
  const alumnos = new Map<number, AlumnoAsistencia>()
  if (ids.length) {
    const data = await filasPorIds<Record<string, unknown>>(
      ids,
      (trozo, d, h) =>
        db()
          .from('alumno')
          .select('alumno_id, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo')
          .in('alumno_id', trozo)
          .order('alumno_id')
          .range(d, h),
      'Alumnos'
    )
    for (const r of data) {
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

type FilaDia = { registro: RegistroAsistencia | null; incidencia: IncidenciaMaestro | null }

async function registrosDelDia(fecha: string, asignacionIds: number[]): Promise<Map<number, FilaDia>> {
  const out = new Map<number, FilaDia>()
  if (!asignacionIds.length) return out
  const { data, error } = await db()
    .from('taller_asistencia')
    .select(`asignacion_id, total_alumnos, faltas, registrado_por, updated_at, lista_pasada, ${SELECT_INCIDENCIA}`)
    .eq('fecha', fecha)
    .in('asignacion_id', asignacionIds)
  fail(error, 'Asistencia')
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    out.set(Number(r.asignacion_id), {
      registro:
        r.lista_pasada === false
          ? null
          : {
              total_alumnos: r.total_alumnos == null ? null : Number(r.total_alumnos),
              faltas: Array.isArray(r.faltas) ? (r.faltas as unknown[]).map(Number) : [],
              registrado_por: (r.registrado_por as string | null) ?? null,
              updated_at: String(r.updated_at ?? ''),
            },
      incidencia: mapIncidencia(r),
    })
  }
  return out
}

export const SELECT_INCIDENCIA =
  'maestro_falto, llegada_maestro, salida_maestro, incidencia_motivo, incidencia_nota, incidencia_por, incidencia_at'

const hhmm = (v: unknown) => (v ? String(v).slice(0, 5) : null)

export function mapIncidencia(r: Record<string, unknown>): IncidenciaMaestro | null {
  const falto = r.maestro_falto === true
  const llegada = falto ? null : hhmm(r.llegada_maestro)
  const salida = falto ? null : hhmm(r.salida_maestro)
  if (!falto && !llegada && !salida) return null
  return {
    falto,
    llegada,
    salida,
    motivo: (r.incidencia_motivo as string | null) ?? null,
    nota: (r.incidencia_nota as string | null) ?? null,
    registrado_por: (r.incidencia_por as string | null) ?? null,
    updated_at: (r.incidencia_at as string | null) ?? null,
  }
}

/** Maestro y horario vigentes ese día: el reporte de horas usa esta copia aunque el grupo se edite después. */
function programadoDelDia(a: TallerAsignacion, fecha: string) {
  const delDia = a.horarios
    .filter((h) => h.dia === diaSemana(fecha))
    .sort((x, y) => minutosDeHora(x.hora_inicio) - minutosDeHora(y.hora_inicio))
  if (!delDia.length) return null
  return {
    maestro_id: a.maestro_id,
    hora_inicio: delDia[0].hora_inicio,
    hora_fin: delDia.at(-1)!.hora_fin,
    minutos_programados: delDia.reduce(
      (s, h) => s + Math.max(0, minutosDeHora(h.hora_fin) - minutosDeHora(h.hora_inicio)),
      0
    ),
  }
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
  const [alumnos, registros] = await Promise.all([alumnosDeGrupos(ids, fecha), registrosDelDia(fecha, ids)])

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
        registro: registros.get(a.id)?.registro ?? null,
        incidencia: registros.get(a.id)?.incidencia ?? null,
      }
    })
    .sort(
      (x, y) =>
        minutosDeHora(x.hora_inicio) - minutosDeHora(y.hora_inicio) ||
        x.taller.localeCompare(y.taller, 'es')
    )

  return {
    ciclo: snap.ciclo,
    fecha,
    hoy,
    dia,
    editable: esEditable(fecha, hoy),
    sesiones,
  }
}

function exigirEditable(fecha: string, hoy: string): void {
  if (!esEditable(fecha, hoy)) {
    throw new TalleresError(
      fecha > hoy
        ? 'Todavía no llega ese día: solo se puede pasar lista de hoy o días anteriores.'
        : `Solo se puede editar hoy o los últimos ${DIAS_EDITABLES_ASISTENCIA} días.`
    )
  }
}

export async function guardarAsistencia(body: Record<string, unknown>): Promise<RegistroAsistencia> {
  const hoy = hoyMexico()
  const fecha = fechaValida(body.fecha)
  exigirEditable(fecha, hoy)
  const asignacionId = idEntero(body.asignacion_id)
  const snap = await snapshotTalleres()
  const asignacion = snap.asignaciones.find((a) => a.id === asignacionId)
  if (!asignacion) throw new TalleresError('El taller no existe o no es del ciclo actual.', 404)
  const programado = programadoDelDia(asignacion, fecha)
  if (!programado) throw new TalleresError('Ese taller no tiene clase en la fecha elegida.')

  const inscritos = new Set(
    ((await alumnosDeGrupos([asignacionId], fecha)).get(asignacionId) ?? []).map((a) => a.alumno_id)
  )
  const faltas = Array.isArray(body.faltas)
    ? [...new Set((body.faltas as unknown[]).slice(0, 500).map(idEntero))].filter((id) => inscritos.has(id))
    : []

  let total: number | null = null
  if (faltas.length) {
    // Con faltas marcadas, el total sale de la lista.
    total = inscritos.size - faltas.length
  } else if (body.total_alumnos !== null && body.total_alumnos !== undefined && body.total_alumnos !== '') {
    total = Number(body.total_alumnos)
    if (!Number.isInteger(total) || total < 0 || total > 500) {
      throw new TalleresError('El total de alumnos debe ser un número entre 0 y 500.')
    }
  }

  const registradoPor = String(body.registrado_por ?? '').trim().slice(0, 80) || null
  const updated_at = new Date().toISOString()
  // Si ya había fila del día (lista previa o incidencia), se conserva el maestro/horario que se copió entonces.
  const { data: previa, error: pErr } = await db()
    .from('taller_asistencia')
    .select('minutos_programados')
    .eq('asignacion_id', asignacionId)
    .eq('fecha', fecha)
    .maybeSingle()
  fail(pErr, 'Asistencia')
  const copia = (previa as { minutos_programados: number | null } | null)?.minutos_programados != null ? {} : programado
  const { error } = await db()
    .from('taller_asistencia')
    .upsert(
      [
        {
          asignacion_id: asignacionId,
          fecha,
          total_alumnos: total,
          faltas,
          registrado_por: registradoPor,
          updated_at,
          lista_pasada: true,
          ...copia,
        },
      ],
      { onConflict: 'asignacion_id,fecha' }
    )
  fail(error, 'Guardar asistencia')
  return { total_alumnos: total, faltas, registrado_por: registradoPor, updated_at }
}

function horaOpcional(raw: unknown, campo: string): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.slice(0, 5))) throw new TalleresError(`Hora de ${campo} inválida.`)
  return s.slice(0, 5)
}

/**
 * Registra (o quita, si no viene nada) que el maestro no asistió, llegó tarde o salió antes.
 * No requiere pase de lista: si aún no hay fila del día se crea con `lista_pasada = false`.
 */
export async function guardarIncidencia(body: Record<string, unknown>): Promise<IncidenciaMaestro | null> {
  const hoy = hoyMexico()
  const fecha = fechaValida(body.fecha)
  exigirEditable(fecha, hoy)
  const asignacionId = idEntero(body.asignacion_id)
  const snap = await snapshotTalleres()
  const asignacion = snap.asignaciones.find((a) => a.id === asignacionId)
  if (!asignacion) throw new TalleresError('El taller no existe o no es del ciclo actual.', 404)
  const delDia = asignacion.horarios
    .filter((h) => h.dia === diaSemana(fecha))
    .sort((x, y) => minutosDeHora(x.hora_inicio) - minutosDeHora(y.hora_inicio))
  const programado = programadoDelDia(asignacion, fecha)
  if (!delDia.length || !programado) throw new TalleresError('Ese taller no tiene clase en la fecha elegida.')
  const inicio = Math.min(...delDia.map((h) => minutosDeHora(h.hora_inicio)))
  const fin = Math.max(...delDia.map((h) => minutosDeHora(h.hora_fin)))
  const rango = `${hora12(delDia[0].hora_inicio)} – ${hora12(delDia.at(-1)!.hora_fin)}`

  const { data: fila, error: fErr } = await db()
    .from('taller_asistencia')
    .select('id, lista_pasada, minutos_programados')
    .eq('asignacion_id', asignacionId)
    .eq('fecha', fecha)
    .maybeSingle()
  fail(fErr, 'Asistencia')
  const filaRaw = fila as { id: number; lista_pasada: boolean; minutos_programados: number | null } | null

  const falto = body.falto === true
  const llegada = falto ? null : horaOpcional(body.llegada, 'llegada')
  const salida = falto ? null : horaOpcional(body.salida, 'salida')
  if (llegada && (minutosDeHora(llegada) <= inicio || minutosDeHora(llegada) >= fin)) {
    throw new TalleresError(`La hora de llegada debe quedar dentro de la clase (${rango}) y después del inicio.`)
  }
  if (salida && (minutosDeHora(salida) <= inicio || minutosDeHora(salida) >= fin)) {
    throw new TalleresError(`La hora de salida debe quedar dentro de la clase (${rango}) y antes del final.`)
  }
  if (llegada && salida && minutosDeHora(salida) <= minutosDeHora(llegada)) {
    throw new TalleresError('La salida debe ser después de la llegada.')
  }

  const hay = Boolean(falto || llegada || salida)
  const cambios = {
    maestro_falto: falto,
    llegada_maestro: llegada,
    salida_maestro: salida,
    incidencia_motivo: hay ? String(body.motivo ?? '').trim().slice(0, 60) || null : null,
    incidencia_nota: hay ? String(body.nota ?? '').trim().slice(0, 300) || null : null,
    incidencia_por: hay ? String(body.registrado_por ?? '').trim().slice(0, 80) || null : null,
    incidencia_at: hay ? new Date().toISOString() : null,
  }
  const f = filaRaw
    ? { id: filaRaw.id, lista_pasada: filaRaw.lista_pasada, programado: filaRaw.minutos_programados != null }
    : null
  if (!f) {
    if (!hay) return null
    const { error } = await db()
      .from('taller_asistencia')
      .insert([{ asignacion_id: asignacionId, fecha, faltas: [], lista_pasada: false, ...cambios, ...programado }])
    fail(error, 'Guardar incidencia')
  } else if (!hay && f.lista_pasada === false) {
    const { error } = await db().from('taller_asistencia').delete().eq('id', Number(f.id))
    fail(error, 'Quitar incidencia')
  } else {
    const { error } = await db()
      .from('taller_asistencia')
      .update({ ...cambios, ...(f.programado ? {} : programado) })
      .eq('id', Number(f.id))
    fail(error, 'Guardar incidencia')
  }
  return mapIncidencia(cambios)
}

/**
 * Deshace el pase de lista del día (se equivocaron de taller o de día).
 * Si hay incidencia del maestro se conserva; si no, la fila desaparece.
 */
export async function quitarAsistencia(body: Record<string, unknown>): Promise<void> {
  const hoy = hoyMexico()
  const fecha = fechaValida(body.fecha)
  exigirEditable(fecha, hoy)
  const asignacionId = idEntero(body.asignacion_id)
  if (!asignacionId) throw new TalleresError('Taller inválido.')
  const { data: fila, error: fErr } = await db()
    .from('taller_asistencia')
    .select('id, maestro_falto, llegada_maestro, salida_maestro')
    .eq('asignacion_id', asignacionId)
    .eq('fecha', fecha)
    .maybeSingle()
  fail(fErr, 'Asistencia')
  const f = fila as { id: number; maestro_falto: boolean; llegada_maestro: string | null; salida_maestro: string | null } | null
  if (!f) return
  if (f.maestro_falto || f.llegada_maestro || f.salida_maestro) {
    const { error } = await db()
      .from('taller_asistencia')
      .update({
        lista_pasada: false,
        total_alumnos: null,
        faltas: [],
        registrado_por: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', f.id)
    fail(error, 'Quitar asistencia')
  } else {
    const { error } = await db().from('taller_asistencia').delete().eq('id', f.id)
    fail(error, 'Quitar asistencia')
  }
}
