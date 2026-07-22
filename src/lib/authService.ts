import type { AuthSession } from './portalAuthService'
import { sessionToLegacyUser } from './portalAuthService'

export interface Usuario {
  usuario_id: number
  perfil_id: number
  usuario_username: string
  usuario_password: string
  usuario_nombre: string
  usuario_app: string
  usuario_apm: string
  usuario_email: string
  usuario_status: number
  usuario_alta?: string
  nivel: number
  usuario_nombre_completo?: string
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthUser {
  usuario_id: number
  usuario_username: string
  usuario_nombre_completo: string
}

export async function loginUser(credentials: LoginCredentials): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password,
      }),
    })

    if (res.status === 401) return null

    if (!res.ok) {
      throw new Error('Error de conexión con la base de datos')
    }

    const body = (await res.json()) as { session?: AuthSession }
    const session = body.session
    if (!session || session.role !== 'usuario') return null

    return sessionToLegacyUser(session)
  } catch (error) {
    console.error('Error en loginUser:', error)
    throw error
  }
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    // Misma fuente que el portal: sessionStorage (no localStorage).
    const raw = sessionStorage.getItem('portal_auth_session')
    if (!raw) return null
    const session = JSON.parse(raw) as AuthSession
    if (session?.role !== 'usuario') return null
    return sessionToLegacyUser(session)
  } catch {
    return null
  }
}

export function storeUser(user: AuthUser): void {
  if (typeof window === 'undefined') return
  const session: AuthSession = {
    role: 'usuario',
    displayName: user.usuario_nombre_completo,
    usuario_id: user.usuario_id,
    usuario_username: user.usuario_username,
  }
  try {
    localStorage.removeItem('portal_auth_session')
    localStorage.removeItem('auth_user')
    sessionStorage.setItem('portal_auth_session', JSON.stringify(session))
  } catch {
    /* ignore */
  }
}

export function clearStoredUser(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem('portal_auth_session')
    sessionStorage.removeItem('auth_user')
    localStorage.removeItem('portal_auth_session')
    localStorage.removeItem('auth_user')
  } catch {
    /* ignore */
  }
}
