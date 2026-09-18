import { createAdminClient, type InsForgeClient } from '@insforge/sdk'

let desayunosAdmin: InsForgeClient | null = null

function isWinstonHost(url: string): boolean {
  return url.includes('g4ta4bfg')
}

/**
 * Cliente admin para tablas POS Desayunos.
 * Tras cutover (2026-09-18) las tablas viven en Winston Servicios (g4ta4bfg).
 * Si INSFORGE_DESAYUNOS_* aún apunta al NANO viejo, se ignora y se usa Winston.
 */
export function requireDesayunosAdminEnv() {
  const desayunosUrl = (
    process.env.INSFORGE_DESAYUNOS_URL ??
    process.env.NEXT_PUBLIC_INSFORGE_DESAYUNOS_URL ??
    ''
  ).replace(/\/$/, '')
  const desayunosKey = process.env.INSFORGE_DESAYUNOS_API_KEY ?? ''

  const winstonUrl = (
    process.env.NEXT_PUBLIC_INSFORGE_URL ??
    process.env.INSFORGE_URL ??
    ''
  ).replace(/\/$/, '')
  const winstonKey = process.env.INSFORGE_API_KEY ?? ''

  if (desayunosUrl && desayunosKey && isWinstonHost(desayunosUrl)) {
    return { baseUrl: desayunosUrl, apiKey: desayunosKey }
  }

  if (winstonUrl && winstonKey && isWinstonHost(winstonUrl)) {
    return { baseUrl: winstonUrl, apiKey: winstonKey }
  }

  if (desayunosUrl && desayunosKey) {
    // Fallback legacy (solo si Winston no está configurado)
    return { baseUrl: desayunosUrl, apiKey: desayunosKey }
  }

  throw new Error(
    'Faltan credenciales InsForge Winston para Desayunos POS (NEXT_PUBLIC_INSFORGE_URL + INSFORGE_API_KEY).'
  )
}

export function getDesayunosAdmin(): InsForgeClient {
  if (desayunosAdmin) return desayunosAdmin
  const { baseUrl, apiKey } = requireDesayunosAdminEnv()
  desayunosAdmin = createAdminClient({ baseUrl, apiKey })
  return desayunosAdmin
}
