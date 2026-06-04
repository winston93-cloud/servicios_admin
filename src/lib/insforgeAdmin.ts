import { createAdminClient, type InsForgeClient } from '@insforge/sdk'
import type { AppDatabaseClient } from './dbTypes'

function requireInsforgeAdminEnv() {
  const baseUrl =
    process.env.NEXT_PUBLIC_INSFORGE_URL ?? process.env.INSFORGE_URL
  const apiKey = process.env.INSFORGE_API_KEY
  if (!baseUrl || !apiKey) {
    throw new Error(
      'Faltan NEXT_PUBLIC_INSFORGE_URL (o INSFORGE_URL) e INSFORGE_API_KEY en .env.local.'
    )
  }
  return { baseUrl, apiKey }
}

let admin: InsForgeClient | null = null

/** Cliente admin completo (DB, storage, functions). Solo servidor. */
export function createInsforgeAdmin(): InsForgeClient {
  if (!admin) {
    admin = createAdminClient(requireInsforgeAdminEnv())
  }
  return admin
}

/** Capa database con API key admin (reemplaza service role de Supabase). */
export function createDbAdmin(): AppDatabaseClient {
  return createInsforgeAdmin().database
}
