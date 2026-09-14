import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { becarioPorUsername, passwordBecario } from '@/lib/becariosCatalog'
import { mensajeErrorPublico, statusHttpDesdeError } from '@/lib/apiErrorPublico'

export const BECARIOS_AUTH_COOKIE = 'becarios_bitacora_auth'

export type BecariosSesion = {
  username: string
  nombre: string
  exp: number
}

export class BecariosAuthError extends Error {
  status: number
  constructor(message: string, status = 401) {
    super(message)
    this.status = status
  }
}

function sessionSecret(): string {
  return (
    process.env.BECARIOS_SESSION_SECRET ||
    process.env.INSFORGE_API_KEY ||
    'becarios-bitacora-dev-secret'
  )
}

function signPayload(payloadB64: string): string {
  return createHmac('sha256', sessionSecret()).update(payloadB64).digest('base64url')
}

export function encodeBecariosSession(
  session: Omit<BecariosSesion, 'exp'> & { exp?: number }
): string {
  const full: BecariosSesion = {
    ...session,
    exp: session.exp ?? Date.now() + 12 * 60 * 60 * 1000,
  }
  const payloadB64 = Buffer.from(JSON.stringify(full), 'utf8').toString('base64url')
  return `${payloadB64}.${signPayload(payloadB64)}`
}

export function decodeBecariosSession(token: string | null | undefined): BecariosSesion | null {
  if (!token) return null
  const [payloadB64, sig] = token.split('.')
  if (!payloadB64 || !sig) return null
  const expected = signPayload(payloadB64)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const session = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as BecariosSesion
    if (!session?.username || !session?.exp) return null
    if (session.exp < Date.now()) return null
    if (!becarioPorUsername(session.username)) return null
    return session
  } catch {
    return null
  }
}

export function cookieBecariosDesdeHeader(cookieHeader: string | null): BecariosSesion | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${BECARIOS_AUTH_COOKIE}=([^;]*)`))
  if (!match?.[1]) return null
  try {
    return decodeBecariosSession(decodeURIComponent(match[1]))
  } catch {
    return null
  }
}

export function opcionesCookieBecarios(token: string) {
  return {
    name: BECARIOS_AUTH_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 12,
  }
}

export function opcionesCookieBecariosClear() {
  return {
    name: BECARIOS_AUTH_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  }
}

function passwordMatches(expected: string, plain: string): boolean {
  if (!expected || !plain) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(plain)
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function autenticarBecario(usernameRaw: string, password: string): BecariosSesion | null {
  const perfil = becarioPorUsername(usernameRaw)
  if (!perfil) return null
  const expected = passwordBecario(perfil.username)
  if (!passwordMatches(expected, password.trim())) return null
  return {
    username: perfil.username,
    nombre: perfil.nombre,
    exp: Date.now() + 12 * 60 * 60 * 1000,
  }
}

export async function requireBecariosSession(req?: Request): Promise<BecariosSesion> {
  let session: BecariosSesion | null = null
  if (req) session = cookieBecariosDesdeHeader(req.headers.get('cookie'))
  else {
    const jar = await cookies()
    session = decodeBecariosSession(jar.get(BECARIOS_AUTH_COOKIE)?.value)
  }
  if (!session) throw new BecariosAuthError('No autenticado')
  return session
}

export function jsonBecariosError(e: unknown): { error: string; status: number } {
  if (e instanceof BecariosAuthError) return { error: e.message, status: e.status }
  return { error: mensajeErrorPublico(e), status: statusHttpDesdeError(e) }
}
