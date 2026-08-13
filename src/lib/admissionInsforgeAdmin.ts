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

/**
 * Mapa alumno_ref → fecha de cita (YYYY-MM-DD) en AgendaW.
 * Usa appointment_date (fecha que agendan para el examen).
 */
export async function mapaFechaAgendaPorAlumnoRef(opts: {
  nivel: number
  desde: string
  hasta: string
}): Promise<Map<number, string> | null> {
  if (!admissionEnvConfigured()) return null

  const level = levelAgendaDesdeNivel(opts.nivel)
  if (!level) return null

  const db = createAdmissionDb()
  const desde = opts.desde.slice(0, 10)
  const hasta = opts.hasta.slice(0, 10)
  const out = new Map<number, string>()
  let offset = 0
  const PAGE = 500

  while (true) {
    const { data, error } = await db
      .from('admission_appointments')
      .select('alumno_ref, appointment_date, status')
      .eq('level', level)
      .not('alumno_ref', 'is', null)
      .neq('status', 'cancelled')
      .gte('appointment_date', desde)
      .lte('appointment_date', hasta)
      .range(offset, offset + PAGE - 1)

    if (error) throw new Error(`AgendaW citas: ${error.message}`)
    const chunk = data ?? []
    for (const r of chunk) {
      const ref = Number(r.alumno_ref)
      const fecha = String(r.appointment_date ?? '').slice(0, 10)
      if (!(ref > 0) || !fecha) continue
      // Conservar la cita más temprana del rango si hay varias.
      const prev = out.get(ref)
      if (!prev || fecha < prev) out.set(ref, fecha)
    }
    if (chunk.length < PAGE) break
    offset += PAGE
  }

  return out
}
