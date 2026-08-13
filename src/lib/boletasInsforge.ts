import { createAdminClient, type InsForgeClient } from '@insforge/sdk'
import type { AppDatabaseClient } from './dbTypes'

function requireBoletasInsforgeEnv() {
  const baseUrl =
    process.env.BOLETAS_INSFORGE_URL ?? process.env.NEXT_PUBLIC_BOLETAS_INSFORGE_URL
  const apiKey = process.env.BOLETAS_INSFORGE_API_KEY
  if (!baseUrl || !apiKey) {
    throw new Error(
      'Faltan BOLETAS_INSFORGE_URL y BOLETAS_INSFORGE_API_KEY (proyecto InsForge boletas).'
    )
  }
  return { baseUrl, apiKey }
}

let admin: InsForgeClient | null = null

/** Cliente admin del proyecto InsForge «boletas». Solo servidor. */
export function createBoletasInsforgeAdmin(): InsForgeClient {
  if (!admin) {
    admin = createAdminClient(requireBoletasInsforgeEnv())
  }
  return admin
}

export function createBoletasDb(): AppDatabaseClient {
  return createBoletasInsforgeAdmin().database
}

export function boletasEnvConfigured(): boolean {
  try {
    requireBoletasInsforgeEnv()
    return true
  } catch {
    return false
  }
}
