import { createHmac, timingSafeEqual } from 'crypto'
import type { NextResponse } from 'next/server'
import { normalizarSesion, type AuthSession } from '@/lib/portalAuthService'

/**
 * Sesión del portal firmada en cookie httpOnly. El JSON en sessionStorage / `x-portal-session`
 * lo puede fabricar cualquiera; las APIs y el proxy de BD solo confían en esta cookie.
 */
export const PORTAL_SESION_COOKIE = 'portal_sesion'
const DURACION_MS = 14 * 60 * 60 * 1000

function secreto(): string {
  const propio = process.env.PORTAL_SESSION_SECRET
  if (propio) return propio
  const base = process.env.INSFORGE_API_KEY
  if (!base) throw new Error('Falta INSFORGE_API_KEY para firmar la sesión del portal.')
  return createHmac('sha256', base).update('portal-sesion-v1').digest('hex')
}

function firmar(payloadB64: string): string {
  return createHmac('sha256', secreto()).update(payloadB64).digest('base64url')
}

export function crearTokenSesionPortal(session: AuthSession): string {
  const payload = { ...session, exp: Date.now() + DURACION_MS }
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${payloadB64}.${firmar(payloadB64)}`
}

export function leerTokenSesionPortal(token: string | null | undefined): AuthSession | null {
  if (!token) return null
  const [payloadB64, sig] = token.split('.')
  if (!payloadB64 || !sig) return null
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(firmar(payloadB64))
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const raw = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { exp?: number }
    if (!raw?.exp || raw.exp < Date.now()) return null
    return normalizarSesion(raw)
  } catch {
    return null
  }
}

export function sesionPortalDeRequest(request: Request): AuthSession | null {
  const cookies = request.headers.get('cookie')
  if (!cookies) return null
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${PORTAL_SESION_COOKIE}=([^;]*)`))
  if (!match?.[1]) return null
  try {
    return leerTokenSesionPortal(decodeURIComponent(match[1]))
  } catch {
    return null
  }
}

export function ponerCookieSesionPortal(res: NextResponse, session: AuthSession) {
  res.cookies.set({
    name: PORTAL_SESION_COOKIE,
    value: crearTokenSesionPortal(session),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(DURACION_MS / 1000),
  })
}

export function borrarCookieSesionPortal(res: NextResponse) {
  res.cookies.set({ name: PORTAL_SESION_COOKIE, value: '', httpOnly: true, path: '/', maxAge: 0 })
}
