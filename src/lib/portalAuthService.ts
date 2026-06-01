import { supabase } from './supabase'

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

/** Clave maestra de soporte para acceso alumno (solo validación por alumno_ref). */
const ALUMNO_CLAVE_MAESTRA = '2671st'

export const PORTALES_ALUMNO = ['/portal-pagos', '/portal-inscripciones'] as const

async function loginUsuario(
  username: string,
  password: string
): Promise<AuthSession | null> {
  const { data, error } = await supabase
    .from('usuario')
    .select(
      'usuario_id, usuario_username, usuario_password, usuario_nombre, usuario_app, usuario_apm'
    )
    .eq('usuario_username', username)
    .eq('usuario_password', password)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    console.error('loginUsuario:', error)
    throw new Error('Error de conexión con la base de datos')
  }

  if (!data) return null

  const displayName =
    `${data.usuario_nombre ?? ''} ${data.usuario_app ?? ''} ${data.usuario_apm ?? ''}`.trim() ||
    data.usuario_username

  return {
    role: 'usuario',
    displayName,
    usuario_id: data.usuario_id,
    usuario_username: data.usuario_username,
  }
}

function sessionDesdeAlumno(data: {
  alumno_id: number
  alumno_ref: number | null
  alumno_nombre: string | null
  alumno_app: string | null
  alumno_apm: string | null
}): AuthSession {
  const displayName =
    `${data.alumno_nombre ?? ''} ${data.alumno_app ?? ''} ${data.alumno_apm ?? ''}`.trim() ||
    `Alumno ${data.alumno_ref}`

  return {
    role: 'alumno',
    displayName,
    alumno_id: data.alumno_id,
    alumno_ref: data.alumno_ref ?? undefined,
  }
}

async function loginAlumno(
  refInput: string,
  password: string
): Promise<AuthSession | null> {
  const ref = parseInt(refInput.replace(/\D/g, ''), 10)
  if (!Number.isFinite(ref) || ref <= 0) return null

  const { data: alumno, error: errAlumno } = await supabase
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_status')
    .eq('alumno_ref', ref)
    .maybeSingle()

  if (errAlumno && errAlumno.code !== 'PGRST116') {
    console.error('loginAlumno alumno:', errAlumno)
    throw new Error('Error de conexión con la base de datos')
  }

  if (!alumno || alumno.alumno_status !== 1) return null

  const claveMaestra = password === ALUMNO_CLAVE_MAESTRA

  if (!claveMaestra) {
    const { data: detalle, error: errDetalle } = await supabase
      .from('alumno_detalles')
      .select('alumno_clave')
      .eq('alumno_id', alumno.alumno_id)
      .maybeSingle()

    if (errDetalle && errDetalle.code !== 'PGRST116') {
      console.error('loginAlumno detalles:', errDetalle)
      throw new Error('Error de conexión con la base de datos')
    }

    const claveDb = (detalle?.alumno_clave ?? '').trim()
    const claveIngresada = password.trim()

    if (!claveDb || claveDb !== claveIngresada) {
      return null
    }
  }

  return sessionDesdeAlumno(alumno)
}

/**
 * Acceso unificado: personal por usuario_username; alumno por alumno_ref + alumno_detalles.alumno_clave.
 */
export async function loginPortal(
  credentials: PortalLoginCredentials
): Promise<AuthSession | null> {
  const username = credentials.username.trim()
  const password = credentials.password.trim()
  if (!username || !password) return null

  const staff = await loginUsuario(username, password)
  if (staff) return staff

  const alumno = await loginAlumno(username, password)
  if (alumno) return alumno

  return null
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
