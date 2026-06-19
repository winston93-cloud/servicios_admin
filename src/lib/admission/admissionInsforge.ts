import { createAdminClient as createInsforgeAdminClient, type InsForgeClient } from '@insforge/sdk'
import type { AppDatabaseClient } from '@/lib/dbTypes'
import {
  admissionInsforgeApiKey,
  admissionInsforgeUrl,
} from './admissionInsforgeEnv'

function requireAdmissionInsforgeEnv() {
  const baseUrl = admissionInsforgeUrl()
  const apiKey = admissionInsforgeApiKey()
  if (!baseUrl || !apiKey) {
    throw new Error(
      'Faltan ADMISSION_INSFORGE_URL (o NEXT_PUBLIC_ADMISSION_INSFORGE_URL) y ADMISSION_INSFORGE_API_KEY.'
    )
  }
  return { baseUrl, apiKey }
}

let admin: InsForgeClient | null = null

export function createAdmissionInsforgeAdmin(): InsForgeClient {
  if (!admin) {
    admin = createInsforgeAdminClient(requireAdmissionInsforgeEnv())
  }
  return admin
}

/** Cliente database admin del proyecto AgendaW en InsForge. */
export function createAdmissionDbAdmin(): AppDatabaseClient {
  return createAdmissionInsforgeAdmin().database
}

/** Alias usado por el código portado de agendaw. */
export const createAdminClient = createAdmissionDbAdmin
