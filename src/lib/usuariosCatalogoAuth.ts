import { createHmac } from 'crypto'

/** PIN de acceso al catálogo CRUD de usuarios (servicios/usuarios). */
export const USUARIOS_PIN = '2671st'

export const USUARIOS_AUTH_COOKIE = 'usuarios_catalogo_auth'

export function pinUsuariosValido(pin: string | null | undefined): boolean {
  return String(pin ?? '').trim() === USUARIOS_PIN
}

export function tokenCookieUsuarios(): string {
  return createHmac('sha256', USUARIOS_PIN).update('usuarios-catalogo-acceso-v1').digest('hex')
}

export function cookieUsuariosValida(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${USUARIOS_AUTH_COOKIE}=([^;]*)`)
  )
  if (!match?.[1]) return false
  try {
    return decodeURIComponent(match[1]) === tokenCookieUsuarios()
  } catch {
    return false
  }
}

export function opcionesCookieUsuarios(): {
  name: string
  value: string
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax'
  path: string
  maxAge: number
} {
  return {
    name: USUARIOS_AUTH_COOKIE,
    value: tokenCookieUsuarios(),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 4,
  }
}
