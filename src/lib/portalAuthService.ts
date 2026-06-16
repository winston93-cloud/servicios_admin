export type AuthRole = 'alumno' | 'usuario'

export interface AuthSession {
  role: AuthRole
  displayName: string
  alumno_id?: number
  alumno_ref?: number
  usuario_id?: number
  usuario_username?: string
}

export interface PortalLoginCredentials {
  username: string
  password: string
}

const STORAGE_KEY = 'portal_auth_session'

export const PORTALES_ALUMNO = ['/portal-pagos', '/portal-inscripciones'] as const

/**
 * Acceso unificado: personal por usuario_username; alumno por alumno_ref + clave.
 * Validación en servidor (/api/auth/login) — no expone tablas usuario/alumno al navegador.
 */
export async function loginPortal(
  credentials: PortalLoginCredentials
): Promise<AuthSession | null> {
  const username = credentials.username.trim()
  const password = credentials.password.trim()
  if (!username || !password) return null

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (res.status === 401) return null

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      typeof body.error === 'string' ? body.error : 'Error de conexión con la base de datos'
    )
  }

  const body = (await res.json()) as { session?: AuthSession }
  return body.session ?? null
}

export function getStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (parsed?.role !== 'alumno' && parsed?.role !== 'usuario') return null
    return parsed
  } catch {
    return null
  }
}

export function storeSession(session: AuthSession): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem('auth_user')
}

/** Compatibilidad con código que aún usa AuthUser */
export function sessionToLegacyUser(session: AuthSession) {
  return {
    usuario_id: session.usuario_id ?? session.alumno_id ?? 0,
    usuario_username: session.usuario_username ?? String(session.alumno_ref ?? ''),
    usuario_nombre_completo: session.displayName,
  }
}
