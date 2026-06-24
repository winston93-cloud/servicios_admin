import { createAdminClient, type InsForgeClient } from '@insforge/sdk'

let desayunosAdmin: InsForgeClient | null = null

export function requireDesayunosAdminEnv() {
  const baseUrl =
    process.env.INSFORGE_DESAYUNOS_URL ?? process.env.NEXT_PUBLIC_INSFORGE_DESAYUNOS_URL
  const apiKey = process.env.INSFORGE_DESAYUNOS_API_KEY
  if (!baseUrl || !apiKey) {
    throw new Error(
      'Faltan INSFORGE_DESAYUNOS_URL e INSFORGE_DESAYUNOS_API_KEY (proyecto Desayunos).'
    )
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
}

export function getDesayunosAdmin(): InsForgeClient {
  if (desayunosAdmin) return desayunosAdmin
  const { baseUrl, apiKey } = requireDesayunosAdminEnv()
  desayunosAdmin = createAdminClient({ baseUrl, apiKey })
  return desayunosAdmin
}
