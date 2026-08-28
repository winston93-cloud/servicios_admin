import { createAdminClient, type InsForgeClient } from '@insforge/sdk'
import type { AppDatabaseClient } from './dbTypes'

function requireAdmissionInsforgeEnv() {
  const baseUrl =
    process.env.ADMISSION_INSFORGE_URL ??
    process.env.NEXT_PUBLIC_ADMISSION_INSFORGE_URL ??
    process.env.NEXT_PUBLIC_AGENDAW_INSFORGE_URL
  const apiKey =
    process.env.ADMISSION_INSFORGE_API_KEY ??
    process.env.AGENDAW_INSFORGE_API_KEY
  if (!baseUrl || !apiKey) {
    throw new Error(
      'Faltan ADMISSION_INSFORGE_URL y ADMISSION_INSFORGE_API_KEY (proyecto InsForge AgendaW).'
    )
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
}

let admin: InsForgeClient | null = null

export function admissionEnvConfigured(): boolean {
  try {
    requireAdmissionInsforgeEnv()
    return true
  } catch {
    return false
  }
}

export function createAdmissionInsforgeAdmin(): InsForgeClient {
  if (!admin) {
    admin = createAdminClient(requireAdmissionInsforgeEnv())
  }
  return admin
}

export function createAdmissionDb(): AppDatabaseClient {
  return createAdmissionInsforgeAdmin().database
}

const NIVEL_A_LEVEL: Record<number, string> = {
  1: 'maternal',
  2: 'kinder',
  3: 'primaria',
  4: 'secundaria',
}

export function levelAgendaDesdeNivel(nivel: number): string | null {
  return NIVEL_A_LEVEL[nivel] ?? null
}

/** 2026-08-27: fecha local MX del registro en AgendaW (created_at). */
function fechaAgendamientoDesdeCreatedAt(createdAt: string | null | undefined): string {
  if (!createdAt) return ''
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

function fechaCitaDesdeAppointmentDate(appointmentDate: string | null | undefined): string {
  return String(appointmentDate ?? '').slice(0, 10)
}

function fechaEnRangoCalendario(fecha: string, desde: string, hasta: string): boolean {
  const f = fecha.slice(0, 10)
  const d0 = desde.slice(0, 10)
  const d1 = hasta.slice(0, 10)
  return Boolean(f) && f >= d0 && f <= d1
}

/** Reserva en línea (created_at) vs cita de examen (appointment_date) en AgendaW. */
export type AgendamientoCitaAgendaW = {
  agendo: string
  cita: string
}

/**
 * 2026-08-27: reporte mensual — únicamente el día que agendaron (created_at AgendaW).
 * Sin registro en AgendaW no hay fecha (el alumno queda fuera del mes).
 */
export function fechaMesAgendoAgendaW(agenda: AgendamientoCitaAgendaW | null): string {
  return agenda?.agendo?.slice(0, 10) ?? ''
}

/**
 * 2026-08-28: mensual por nivel (validación ciclo 23).
 * - Maternal/Kinder: mes de alumno_alta; columna = agendo AgendaW o alta.
 * - Primaria: alta en el mes, o reserva+cita AgendaW en el mes (ej. Samantha mayo).
 * - Secundaria sin AgendaW: mes de alta.
 * - Secundaria con AgendaW: reserva y cita en el mismo mes; columna = agendo.
 */
export function evaluarFiltroMesNuevoIngresoAlumno(opts: {
  nivel: number
  refNum: number
  nombre: string
  mapa: MapaAgendamientoAgendaW | null
  alta: string
  registro: string
  desde: string
  hasta: string
}): { incluir: boolean; fechaColumna: string } {
  const fechaAlta = opts.alta.slice(0, 10) || opts.registro.slice(0, 10)
  const reservas = [...listaAgendamientosDesdeMapa(opts.refNum, opts.nombre, opts.mapa)].sort(
    (a, b) => a.agendo.localeCompare(b.agendo)
  )
  const agendoMasAntiguo = reservas.find((r) => r.agendo)?.agendo ?? ''

  const reservaAgendaCitaEnMes = () =>
    reservas.filter(
      (ag) =>
        Boolean(ag.agendo && ag.cita) &&
        fechaEnRangoCalendario(ag.agendo, opts.desde, opts.hasta) &&
        fechaEnRangoCalendario(ag.cita, opts.desde, opts.hasta)
    )

  if (opts.nivel <= 2) {
    return {
      incluir: fechaEnRangoCalendario(fechaAlta, opts.desde, opts.hasta),
      fechaColumna: agendoMasAntiguo || fechaAlta,
    }
  }

  if (opts.nivel === 3) {
    const enMesAgenda = reservaAgendaCitaEnMes()
    const altaEnMes = fechaEnRangoCalendario(fechaAlta, opts.desde, opts.hasta)
    if (!altaEnMes && enMesAgenda.length === 0) {
      return { incluir: false, fechaColumna: '' }
    }
    return {
      incluir: true,
      fechaColumna: enMesAgenda.length > 0 ? enMesAgenda[0].agendo : agendoMasAntiguo || fechaAlta,
    }
  }

  if (reservas.length === 0) {
    return {
      incluir: fechaEnRangoCalendario(fechaAlta, opts.desde, opts.hasta),
      fechaColumna: fechaAlta,
    }
  }

  const enMes = reservaAgendaCitaEnMes()
  if (!enMes.length) {
    return { incluir: false, fechaColumna: '' }
  }
  return { incluir: true, fechaColumna: enMes[0].agendo }
}

/** 2026-08-27: clave para empatar AgendaW ↔ Winston cuando aún no hay alumno_ref. */
export function claveNombreAgendaMatch(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function nombreCompletoAgendaW(r: {
  student_name: string | null
  student_last_name_p: string | null
  student_last_name_m: string | null
}): string {
  return [r.student_name, r.student_last_name_p, r.student_last_name_m]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function registrarAgendamiento(
  porRef: Map<number, AgendamientoCitaAgendaW[]>,
  porNombre: Map<string, AgendamientoCitaAgendaW[]>,
  r: {
    alumno_ref: number | string | null
    created_at: string | null
    appointment_date: string | null
    student_name: string | null
    student_last_name_p: string | null
    student_last_name_m: string | null
  }
) {
  const entry: AgendamientoCitaAgendaW = {
    agendo: fechaAgendamientoDesdeCreatedAt(r.created_at),
    cita: fechaCitaDesdeAppointmentDate(r.appointment_date),
  }
  // 2026-08-27: solo created_at cuenta como día que agendaron.
  if (!entry.agendo) return

  const push = (map: Map<number | string, AgendamientoCitaAgendaW[]>, key: number | string) => {
    const list = map.get(key) ?? []
    const dup = list.some((x) => x.agendo === entry.agendo && x.cita === entry.cita)
    if (!dup) {
      list.push(entry)
      map.set(key, list)
    }
  }

  const ref = Number(r.alumno_ref)
  if (ref > 0) push(porRef, ref)

  const clave = claveNombreAgendaMatch(nombreCompletoAgendaW(r))
  if (clave) push(porNombre, clave)
}

export type MapaAgendamientoAgendaW = {
  porRef: Map<number, AgendamientoCitaAgendaW[]>
  porNombre: Map<string, AgendamientoCitaAgendaW[]>
}

const CAMPOS_CITA_AGENDA =
  'alumno_ref, created_at, appointment_date, status, student_name, student_last_name_p, student_last_name_m'

/**
 * Mapa de citas AgendaW por ctrl y por nombre normalizado.
 */
export async function mapaAgendamientoAgendaW(
  nivel: number,
  refsAlumnos?: number[]
): Promise<MapaAgendamientoAgendaW | null> {
  if (!admissionEnvConfigured()) return null

  const level = levelAgendaDesdeNivel(nivel)
  if (!level) return null

  const db = createAdmissionDb()
  const porRef = new Map<number, AgendamientoCitaAgendaW[]>()
  const porNombre = new Map<string, AgendamientoCitaAgendaW[]>()
  let offset = 0
  const PAGE = 500

  while (true) {
    const { data, error } = await db
      .from('admission_appointments')
      .select(CAMPOS_CITA_AGENDA)
      .eq('level', level)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE - 1)

    if (error) throw new Error(`AgendaW citas: ${error.message}`)
    const chunk = data ?? []
    for (const r of chunk) {
      registrarAgendamiento(porRef, porNombre, r)
    }
    if (chunk.length < PAGE) break
    offset += PAGE
  }

  // 2026-08-27: refuerzo por lista de controles del reporte (por si la paginación omitió filas).
  const refs = [...new Set((refsAlumnos ?? []).filter((n) => n > 0))]
  for (let i = 0; i < refs.length; i += 100) {
    const slice = refs.slice(i, i + 100)
    const { data, error } = await db
      .from('admission_appointments')
      .select(CAMPOS_CITA_AGENDA)
      .eq('level', level)
      .neq('status', 'cancelled')
      .in('alumno_ref', slice)

    if (error) throw new Error(`AgendaW citas por ref: ${error.message}`)
    for (const r of data ?? []) {
      registrarAgendamiento(porRef, porNombre, r)
    }
  }

  return { porRef, porNombre }
}

/** @deprecated Usar mapaAgendamientoAgendaW; conservado por compatibilidad interna. */
export async function mapaFechaAgendaPorAlumnoRef(opts: {
  nivel: number
  desde?: string
  hasta?: string
}): Promise<Map<number, string> | null> {
  const mapa = await mapaAgendamientoAgendaW(opts.nivel)
  if (!mapa) return null
  const out = new Map<number, string>()
  for (const [ref, list] of mapa.porRef) {
    const primero = [...list].sort((a, b) => a.agendo.localeCompare(b.agendo))[0]
    if (primero) out.set(ref, primero.agendo)
  }
  return out
}

function listaAgendamientosDesdeMapa(
  refNum: number,
  nombre: string,
  mapa: MapaAgendamientoAgendaW | null
): AgendamientoCitaAgendaW[] {
  if (!mapa) return []
  if (Number.isFinite(refNum) && refNum > 0) {
    const porRef = mapa.porRef.get(refNum)
    if (porRef?.length) return porRef
  }
  const clave = claveNombreAgendaMatch(nombre)
  if (!clave) return []
  return mapa.porNombre.get(clave) ?? []
}

/** Reserva más antigua en AgendaW (created_at). */
export function agendamientoDesdeMapa(
  refNum: number,
  nombre: string,
  mapa: MapaAgendamientoAgendaW | null
): AgendamientoCitaAgendaW | null {
  const lista = listaAgendamientosDesdeMapa(refNum, nombre, mapa)
  if (!lista.length) return null
  return [...lista].sort((a, b) => a.agendo.localeCompare(b.agendo))[0]
}

/**
 * 2026-08-27: cita cuyo created_at cae en el mes; fecha fija = ese agendo (no varía al cambiar mes).
 */
export function agendamientoAgendoEnMesDesdeMapa(
  refNum: number,
  nombre: string,
  mapa: MapaAgendamientoAgendaW | null,
  desde: string,
  hasta: string
): AgendamientoCitaAgendaW | null {
  const enMes = listaAgendamientosDesdeMapa(refNum, nombre, mapa).filter((ag) =>
    fechaEnRangoCalendario(ag.agendo, desde, hasta)
  )
  if (!enMes.length) return null
  return [...enMes].sort((a, b) => a.agendo.localeCompare(b.agendo))[0]
}

/** @deprecated Preferir evaluarFiltroMesNuevoIngresoAlumno. */
export function fechaAgendamientoDesdeMapa(
  refNum: number,
  nombre: string,
  mapa: MapaAgendamientoAgendaW | null
): string | null {
  const ag = agendamientoDesdeMapa(refNum, nombre, mapa)
  if (!ag) return null
  return ag.agendo
}
