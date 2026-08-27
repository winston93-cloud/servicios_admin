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
  return Boolean(f) && f >= desde && f <= hasta
}

function diffDiasCalendario(desde: string, hasta: string): number {
  const d0 = new Date(`${desde.slice(0, 10)}T12:00:00Z`)
  const d1 = new Date(`${hasta.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(d0.getTime()) || Number.isNaN(d1.getTime())) return 0
  return Math.round((d1.getTime() - d0.getTime()) / 86400000)
}

/** Reserva en línea vs cita de examen en AgendaW. */
export type AgendamientoCitaAgendaW = {
  agendo: string
  cita: string
}

/**
 * 2026-08-27: un solo mes por alumno (mismo universo que reporte general).
 * - Sin AgendaW: alumno_alta, o alumno_registro si falta alta.
 * - Maternal/Kinder: reserva muy anticipada (>30 d) → mes de la cita; si no, reserva.
 * - Primaria: alumno_alta (Winston).
 * - Secundaria: mes de reserva AgendaW (created_at).
 */
export function fechaMesCanonicoNuevoIngreso(opts: {
  nivel: number
  agenda: AgendamientoCitaAgendaW | null
  alta: string
  registro: string
}): string {
  const altaFmt = opts.alta.slice(0, 10)
  const registroFmt = opts.registro.slice(0, 10)
  const ag = opts.agenda

  if (ag?.agendo || ag?.cita) {
    const agendo = ag.agendo || ''
    const cita = ag.cita || ''
    const dias = agendo && cita ? diffDiasCalendario(agendo, cita) : 0

    if (opts.nivel <= 2) {
      if (dias > 30) return cita || altaFmt || registroFmt
      return agendo || cita || altaFmt || registroFmt
    }
    if (opts.nivel === 3) {
      return altaFmt || agendo || cita || registroFmt
    }
    return agendo || cita || altaFmt || registroFmt
  }

  return altaFmt || registroFmt
}

/** Filtra reporte mensual: solo alumnos cuyo mes canónico cae en el rango. */
export function evaluarFiltroMesNuevoIngreso(opts: {
  nivel: number
  agenda: AgendamientoCitaAgendaW | null
  alta: string
  registro: string
  desde: string
  hasta: string
}): { incluir: boolean; fechaColumnaAlta: string } {
  const fecha = fechaMesCanonicoNuevoIngreso({
    nivel: opts.nivel,
    agenda: opts.agenda,
    alta: opts.alta,
    registro: opts.registro,
  })
  const incluir = fechaEnRangoCalendario(fecha, opts.desde, opts.hasta)
  return {
    incluir,
    fechaColumnaAlta: fecha || opts.alta.slice(0, 10) || opts.registro.slice(0, 10),
  }
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
  porRef: Map<number, AgendamientoCitaAgendaW>,
  porNombre: Map<string, AgendamientoCitaAgendaW>,
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
  if (!entry.agendo && !entry.cita) return

  const merge = (map: Map<number | string, AgendamientoCitaAgendaW>, key: number | string) => {
    const prev = map.get(key)
    if (!prev) {
      map.set(key, entry)
      return
    }
    const agendoPrev = prev.agendo || prev.cita
    const agendoNuevo = entry.agendo || entry.cita
    if (agendoNuevo && (!agendoPrev || agendoNuevo < agendoPrev)) {
      map.set(key, entry)
    }
  }

  const ref = Number(r.alumno_ref)
  if (ref > 0) merge(porRef, ref)

  const clave = claveNombreAgendaMatch(nombreCompletoAgendaW(r))
  if (clave) merge(porNombre, clave)
}

export type MapaAgendamientoAgendaW = {
  porRef: Map<number, AgendamientoCitaAgendaW>
  porNombre: Map<string, AgendamientoCitaAgendaW>
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
  const porRef = new Map<number, AgendamientoCitaAgendaW>()
  const porNombre = new Map<string, AgendamientoCitaAgendaW>()
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
  for (const [ref, ag] of mapa.porRef) {
    out.set(ref, ag.cita || ag.agendo)
  }
  return out
}

export function agendamientoDesdeMapa(
  refNum: number,
  nombre: string,
  mapa: MapaAgendamientoAgendaW | null
): AgendamientoCitaAgendaW | null {
  if (!mapa) return null
  if (Number.isFinite(refNum) && refNum > 0) {
    const porRef = mapa.porRef.get(refNum)
    if (porRef) return porRef
  }
  const clave = claveNombreAgendaMatch(nombre)
  if (!clave) return null
  return mapa.porNombre.get(clave) ?? null
}

/** @deprecated Preferir evaluarFiltroMesNuevoIngreso con agenda completa. */
export function fechaAgendamientoDesdeMapa(
  refNum: number,
  nombre: string,
  mapa: MapaAgendamientoAgendaW | null
): string | null {
  const ag = agendamientoDesdeMapa(refNum, nombre, mapa)
  if (!ag) return null
  return ag.cita || ag.agendo
}
