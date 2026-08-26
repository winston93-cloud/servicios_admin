import { createHmac, createHash, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { createDbAdmin } from './insforgeAdmin'

export const RAC_AUTH_COOKIE = 'rac_secundaria_auth'

export type RacRol = 'maestro' | 'coordinacion' | 'psicologia' | 'prefectura' | 'direccion'

export type RacSesion = {
  role: RacRol
  perfil: number
  id: number
  nombre: string
  usuario: string
  exp: number
}

export class RacAuthError extends Error {
  status: number
  constructor(message: string, status = 401) {
    super(message)
    this.status = status
  }
}

function sessionSecret(): string {
  return process.env.INSFORGE_API_KEY || 'rac-secundaria-dev-secret'
}

function signPayload(payloadB64: string): string {
  return createHmac('sha256', sessionSecret()).update(payloadB64).digest('base64url')
}

export function encodeRacSession(session: Omit<RacSesion, 'exp'> & { exp?: number }): string {
  const full: RacSesion = {
    ...session,
    exp: session.exp ?? Date.now() + 12 * 60 * 60 * 1000,
  }
  const payloadB64 = Buffer.from(JSON.stringify(full), 'utf8').toString('base64url')
  return `${payloadB64}.${signPayload(payloadB64)}`
}

export function decodeRacSession(token: string | null | undefined): RacSesion | null {
  if (!token) return null
  const [payloadB64, sig] = token.split('.')
  if (!payloadB64 || !sig) return null
  const expected = signPayload(payloadB64)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const session = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as RacSesion
    if (!session?.id || !session?.exp) return null
    if (session.exp < Date.now()) return null
    return { ...session, role: rolDesdePerfil(Number(session.perfil ?? 1)) }
  } catch {
    return null
  }
}

export function cookieRacDesdeHeader(cookieHeader: string | null): RacSesion | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${RAC_AUTH_COOKIE}=([^;]*)`))
  if (!match?.[1]) return null
  try {
    return decodeRacSession(decodeURIComponent(match[1]))
  } catch {
    return null
  }
}

export function opcionesCookieRac(token: string) {
  return {
    name: RAC_AUTH_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 12,
  }
}

export function md5Hex(raw: string): string {
  return createHash('md5').update(raw, 'utf8').digest('hex')
}

function passwordMatches(stored: string | null | undefined, plain: string): boolean {
  const s = String(stored ?? '')
  if (!s) return false
  if (s === plain) return true
  return s.toLowerCase() === md5Hex(plain).toLowerCase()
}

export function rolDesdePerfil(perfil: number): RacRol {
  if (perfil === 4) return 'psicologia'
  if (perfil === 5) return 'prefectura'
  if (perfil === 6) return 'direccion'
  if (perfil === 1) return 'maestro'
  return 'coordinacion'
}

export async function autenticarRac(usuario: string, password: string): Promise<RacSesion | null> {
  const u = usuario.trim()
  const p = password.trim()
  if (!u || !p) return null
  const db = createDbAdmin()

  const { data: maestros } = await db
    .from('boleta_maestro')
    .select('maestro_id, maestro_app, maestro_apm, maestro_nombre, maestro_usuario, maestro_clave, maestro_email')
    .ilike('maestro_usuario', u)
    .limit(1)

  if (maestros?.[0] && passwordMatches(maestros[0].maestro_clave as string, p)) {
    const m = maestros[0]
    const nombre = [m.maestro_nombre, m.maestro_app, m.maestro_apm]
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .join(' ')
    return {
      role: 'maestro',
      perfil: 1,
      id: Number(m.maestro_id),
      nombre: nombre || u,
      usuario: u,
      exp: Date.now() + 12 * 60 * 60 * 1000,
    }
  }

  const { data: admins } = await db
    .from('usuario')
    .select(
      'usuario_id, perfil_id, usuario_app, usuario_apm, usuario_nombre, usuario_username, usuario_password, usuario_status'
    )
    .ilike('usuario_username', u)
    .limit(1)

  if (admins?.[0]) {
    const a = admins[0]
    if (Number(a.usuario_status ?? 1) === 0) return null
    if (!passwordMatches(a.usuario_password as string, p)) return null
    const perfil = Number(a.perfil_id ?? 2)
    const nombre = [a.usuario_nombre, a.usuario_app, a.usuario_apm]
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .join(' ')
    return {
      role: rolDesdePerfil(perfil),
      perfil,
      id: Number(a.usuario_id),
      nombre: nombre || u,
      usuario: u,
      exp: Date.now() + 12 * 60 * 60 * 1000,
    }
  }

  return null
}

export async function requireRacSession(req?: Request): Promise<RacSesion> {
  let session: RacSesion | null = null
  if (req) session = cookieRacDesdeHeader(req.headers.get('cookie'))
  else {
    const jar = await cookies()
    session = decodeRacSession(jar.get(RAC_AUTH_COOKIE)?.value)
  }
  if (!session) throw new RacAuthError('No autenticado')
  return session
}

export function jsonRacError(err: unknown, fallback = 500) {
  if (err instanceof RacAuthError) {
    return { error: err.message, status: err.status }
  }
  return { error: err instanceof Error ? err.message : String(err), status: fallback }
}
