import { createClient, type InsForgeClient } from '@insforge/sdk'

function requireInsforgePublicEnv() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY
  if (!baseUrl || !anonKey) {
    throw new Error(
      'Faltan NEXT_PUBLIC_INSFORGE_URL o NEXT_PUBLIC_INSFORGE_ANON_KEY en .env.local (InsForge Winston Servicios).'
    )
  }
  return { baseUrl, anonKey }
}

let client: InsForgeClient | null = null

export function getInsforgeClient(): InsForgeClient {
  if (!client) {
    client = createClient(requireInsforgePublicEnv())
  }
  return client
}

/** Acceso a tablas (nombre legacy `supabase` en imports existentes). */
export const insforge = getInsforgeClient()
export const supabase = insforge.database
