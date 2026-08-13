import { createHmac, createHash, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { createBoletasDb } from './boletasInsforge'

export const BOLETAS_AUTH_COOKIE = 'boletas_secundaria_auth'

export type BoletasRole = 'maestro' | 'admin'

export type BoletasSession = {
  role: BoletasRole
  id: number
  nombre: string
  usuario: string
  exp: number
}

function sessionSecret(): string {
  return (
    process.env.BOLETAS_SESSION_SECRET ||
    process.env.BOLETAS_INSFORGE_API_KEY ||
    'boletas-secundaria-dev-secret'
  )
}

function signPayload(payloadB64: string): string {
  return createHmac('sha256', sessionSecret()).update(payloadB64).digest('base64url')
}

export function encodeBoletasSession(session: Omit<BoletasSession, 'exp'> & { exp?: number }): string {
  const full: BoletasSession = {
    ...session,
    exp: session.exp ?? Date.now() + 12 * 60 * 60 * 1000,
  }
  const payloadB64 = Buffer.from(JSON.stringify(full), 'utf8').toString('base64url')
  return `${payloadB64}.${signPayload(payloadB64)}`
}

export function decodeBoletasSession(token: string | null | undefined): BoletasSession | null {
  if (!token) return null
  const [payloadB64, sig] = token.split('.')
  if (!payloadB64 || !sig) return null
  const expected = signPayload(payloadB64)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const session = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as BoletasSession
    if (!session?.role || !session?.id || !session?.exp) return null
    if (session.exp < Date.now()) return null
    return session
  } catch {
    return null
  }
}

export function cookieBoletasDesdeHeader(cookieHeader: string | null): BoletasSession | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${BOLETAS_AUTH_COOKIE}=([^;]*)`)
  )
  if (!match?.[1]) return null
  try {
    return decodeBoletasSession(decodeURIComponent(match[1]))
  } catch {
    return null
  }
}

export function opcionesCookieBoletas(token: string) {
  return {
    name: BOLETAS_AUTH_COOKIE,
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
  const md5 = md5Hex(plain)
  if (s.toLowerCase() === md5.toLowerCase()) return true
  return false
}

export async function autenticarBoletas(
  usuario: string,
  password: string
): Promise<BoletasSession | null> {
  const u = usuario.trim()
  const p = password
  if (!u || !p) return null
  const db = createBoletasDb()

  const { data: maestros, error: errM } = await db
    .from('boleta_maestro')
    .select('maestro_id, maestro_app, maestro_apm, maestro_nombre, maestro_usuario, maestro_clave')
    .eq('maestro_usuario', u)
    .limit(1)

  if (!errM && maestros?.[0] && passwordMatches(maestros[0].maestro_clave as string, p)) {
    const m = maestros[0]
    const nombre = [m.maestro_nombre, m.maestro_app, m.maestro_apm]
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .join(' ')
    return {
      role: 'maestro',
      id: Number(m.maestro_id),
      nombre: nombre || u,
      usuario: u,
      exp: Date.now() + 12 * 60 * 60 * 1000,
    }
  }

  const { data: admins, error: errA } = await db
    .from('usuario')
    .select(
      'usuario_id, usuario_app, usuario_apm, usuario_nombre, usuario_username, usuario_password, usuario_status'
    )
    .eq('usuario_username', u)
    .limit(1)

  if (!errA && admins?.[0]) {
    const a = admins[0]
    if (Number(a.usuario_status ?? 1) === 0) return null
    if (!passwordMatches(a.usuario_password as string, p)) return null
    const nombre = [a.usuario_nombre, a.usuario_app, a.usuario_apm]
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .join(' ')
    return {
      role: 'admin',
      id: Number(a.usuario_id),
      nombre: nombre || u,
      usuario: u,
      exp: Date.now() + 12 * 60 * 60 * 1000,
    }
  }

  return null
}

export async function requireBoletasSession(
  req?: Request
): Promise<BoletasSession> {
  let session: BoletasSession | null = null
  if (req) {
    session = cookieBoletasDesdeHeader(req.headers.get('cookie'))
  } else {
    const jar = await cookies()
    session = decodeBoletasSession(jar.get(BOLETAS_AUTH_COOKIE)?.value)
  }
  if (!session) {
    throw new BoletasAuthError('No autenticado')
  }
  return session
}

export class BoletasAuthError extends Error {
  status = 401
  constructor(message: string) {
    super(message)
    this.name = 'BoletasAuthError'
  }
}

export function requireAdmin(session: BoletasSession): void {
  if (session.role !== 'admin') {
    const err = new BoletasAuthError('Se requiere administrador')
    err.status = 403
    throw err
  }
}
