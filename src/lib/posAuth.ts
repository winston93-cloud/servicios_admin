import { createHmac } from 'crypto'

/** Acceso al POS de Desayunos: solo clave compartida. */
export const POS_CLAVE = 'admin123'

export const POS_AUTH_COOKIE = 'pos_desayunos_auth'

export function clavePosValida(clave: string | null | undefined): boolean {
  return String(clave ?? '').trim() === POS_CLAVE
}

export function tokenCookiePos(): string {
  return createHmac('sha256', POS_CLAVE).update('pos-desayunos-acceso-v1').digest('hex')
}

export function cookiePosValida(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${POS_AUTH_COOKIE}=([^;]*)`)
  )
  if (!match?.[1]) return false
  try {
    return decodeURIComponent(match[1]) === tokenCookiePos()
  } catch {
    return false
  }
}

export function opcionesCookiePos(): {
  name: string
  value: string
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax'
  path: string
  maxAge: number
} {
  return {
    name: POS_AUTH_COOKIE,
    value: tokenCookiePos(),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  }
}
