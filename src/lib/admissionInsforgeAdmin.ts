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

/** 2026-08-27: fecha local MX del agendamiento (created_at), no la cita. */
function fechaAgendamientoDesdeCreatedAt(createdAt: string | null | undefined): string {
  if (!createdAt) return ''
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
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
  porRef: Map<number, string>,
  porNombre: Map<string, string>,
  r: {
    alumno_ref: number | string | null
    created_at: string | null
    student_name: string | null
    student_last_name_p: string | null
    student_last_name_m: string | null
  }
) {
  const fecha = fechaAgendamientoDesdeCreatedAt(r.created_at)
  if (!fecha) return

  const ref = Number(r.alumno_ref)
  if (ref > 0) {
    const prev = porRef.get(ref)
    if (!prev || fecha < prev) porRef.set(ref, fecha)
  }

  const clave = claveNombreAgendaMatch(nombreCompletoAgendaW(r))
  if (clave) {
    const prev = porNombre.get(clave)
    if (!prev || fecha < prev) porNombre.set(clave, fecha)
  }
}

export type MapaAgendamientoAgendaW = {
  porRef: Map<number, string>
  porNombre: Map<string, string>
}

const CAMPOS_CITA_AGENDA =
  'alumno_ref, created_at, status, student_name, student_last_name_p, student_last_name_m'

/**
 * Mapa de agendamientos AgendaW por ctrl y por nombre normalizado.
 * Usa created_at (cuándo agendaron), no appointment_date (día del examen).
 */
export async function mapaAgendamientoAgendaW(
  nivel: number,
  refsAlumnos?: number[]
): Promise<MapaAgendamientoAgendaW | null> {
  if (!admissionEnvConfigured()) return null

  const level = levelAgendaDesdeNivel(nivel)
  if (!level) return null

  const db = createAdmissionDb()
  const porRef = new Map<number, string>()
  const porNombre = new Map<string, string>()
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
  return mapa?.porRef ?? null
}

export function fechaAgendamientoDesdeMapa(
  refNum: number,
  nombre: string,
  mapa: MapaAgendamientoAgendaW | null
): string | null {
  if (!mapa) return null
  if (Number.isFinite(refNum) && refNum > 0) {
    const porRef = mapa.porRef.get(refNum)
    if (porRef) return porRef
  }
  const clave = claveNombreAgendaMatch(nombre)
  if (!clave) return null
  return mapa.porNombre.get(clave) ?? null
}
