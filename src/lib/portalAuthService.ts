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
const LEGACY_AUTH_USER_KEY = 'auth_user'

export const PORTALES_ALUMNO = [
  '/portal-desayunos',
  '/portal-pagos',
  '/portal-inscripciones',
  '/portal-facturacion',
  '/proximamente',
] as const

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
  return normalizarSesion(body.session) 
}

/** Solo acepta sesiones con rol y campos mínimos coherentes (evita mezclar paneles). */
export function normalizarSesion(raw: unknown): AuthSession | null {
  if (!raw || typeof raw !== 'object') return null
  const parsed = raw as Partial<AuthSession>
  const displayName = String(parsed.displayName ?? '').trim()
  if (!displayName) return null

  if (parsed.role === 'usuario') {
    const usuario_id = Number(parsed.usuario_id)
    const usuario_username = String(parsed.usuario_username ?? '').trim()
    if (!Number.isFinite(usuario_id) || usuario_id <= 0 || !usuario_username) return null
    return {
      role: 'usuario',
      displayName,
      usuario_id,
      usuario_username,
    }
  }

  if (parsed.role === 'alumno') {
    const alumno_id = Number(parsed.alumno_id)
    const alumno_ref = Number(parsed.alumno_ref)
    if (!Number.isFinite(alumno_id) || alumno_id <= 0) return null
    if (!Number.isFinite(alumno_ref) || alumno_ref <= 0) return null
    return {
      role: 'alumno',
      displayName,
      alumno_id,
      alumno_ref,
    }
  }

  return null
}

function purgeLegacyLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LEGACY_AUTH_USER_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Sesión de pestaña: sessionStorage.
 * Al cerrar el navegador (o la pestaña) se pierde; no queda en localStorage/cookies.
 * También elimina restos antiguos de localStorage para forzar re-login tras el cambio.
 */
export function getStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') return null
  purgeLegacyLocalStorage()
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const session = normalizarSesion(JSON.parse(raw) as unknown)
    if (!session) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return session
  } catch {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    return null
  }
}

export function storeSession(session: AuthSession): void {
  if (typeof window === 'undefined') return
  const clean = normalizarSesion(session)
  if (!clean) return
  purgeLegacyLocalStorage()
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
  } catch {
    /* ignore */
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(LEGACY_AUTH_USER_KEY)
  } catch {
    /* ignore */
  }
  purgeLegacyLocalStorage()
}

/** Compatibilidad con código que aún usa AuthUser */
export function sessionToLegacyUser(session: AuthSession) {
  return {
    usuario_id: session.usuario_id ?? session.alumno_id ?? 0,
    usuario_username: session.usuario_username ?? String(session.alumno_ref ?? ''),
    usuario_nombre_completo: session.displayName,
  }
}
