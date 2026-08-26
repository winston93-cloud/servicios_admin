import { createHmac, createHash, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import type { RacNivelConfig, RacRolNivel } from './racNivelConfig'
import { esRacNivelSlug, racConfigDeSlug } from './racNivelConfig'

export type RacSesionNivel = {
  role: RacRolNivel
  perfil: number
  id: number
  nombre: string
  usuario: string
  exp: number
  nivelSlug: string
}

export class RacNivelAuthError extends Error {
  status: number
  constructor(message: string, status = 401) {
    super(message)
    this.status = status
  }
}

function sessionSecret(): string {
  return process.env.INSFORGE_API_KEY || 'rac-nivel-dev-secret'
}

function signPayload(payloadB64: string): string {
  return createHmac('sha256', sessionSecret()).update(payloadB64).digest('base64url')
}

export function encodeRacNivelSession(
  cfg: RacNivelConfig,
  session: Omit<RacSesionNivel, 'exp' | 'nivelSlug'> & { exp?: number }
): string {
  const full: RacSesionNivel = {
    ...session,
    nivelSlug: cfg.slug,
    exp: session.exp ?? Date.now() + 12 * 60 * 60 * 1000,
  }
  const payloadB64 = Buffer.from(JSON.stringify(full), 'utf8').toString('base64url')
  return `${payloadB64}.${signPayload(payloadB64)}`
}

export function decodeRacNivelSession(token: string | null | undefined): RacSesionNivel | null {
  if (!token) return null
  const [payloadB64, sig] = token.split('.')
  if (!payloadB64 || !sig) return null
  const expected = signPayload(payloadB64)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const session = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as RacSesionNivel
    if (!session?.id || !session?.exp || !session.nivelSlug) return null
    if (session.exp < Date.now()) return null
    const cfg = racConfigDeSlug(session.nivelSlug)
    if (!cfg) return null
    return { ...session, role: rolDesdePerfilNivel(Number(session.perfil ?? 1), cfg) }
  } catch {
    return null
  }
}

export function cookieRacNivelDesdeHeader(
  cfg: RacNivelConfig,
  cookieHeader: string | null
): RacSesionNivel | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${cfg.cookieAuth}=([^;]*)`))
  if (!match?.[1]) return null
  try {
    const session = decodeRacNivelSession(decodeURIComponent(match[1]))
    if (!session || session.nivelSlug !== cfg.slug) return null
    return session
  } catch {
    return null
  }
}

export function opcionesCookieRacNivel(cfg: RacNivelConfig, token: string) {
  return {
    name: cfg.cookieAuth,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 12,
  }
}

function md5Hex(raw: string): string {
  return createHash('md5').update(raw, 'utf8').digest('hex')
}

function passwordMatches(stored: string | null | undefined, plain: string): boolean {
  const s = String(stored ?? '')
  if (!s) return false
  if (s === plain) return true
  return s.toLowerCase() === md5Hex(plain).toLowerCase()
}

/** En primaria/M-K: perfil 5 = control escolar (no prefectura). */
export function rolDesdePerfilNivel(perfil: number, cfg: RacNivelConfig): RacRolNivel {
  if (perfil === 4) return 'psicologia'
  if (perfil === 5) return 'control_escolar'
  if (perfil === 6) return 'direccion'
  if (perfil === 1) return 'maestro'
  return 'coordinacion'
}

export async function autenticarRacNivel(
  cfg: RacNivelConfig,
  usuario: string,
  password: string
): Promise<RacSesionNivel | null> {
  const u = usuario.trim()
  const p = password
  if (!u || !p) return null
  const db = createDbAdmin()

  const { data: maestros } = await db
    .from('boleta_maestro')
    .select(
      'maestro_id, maestro_app, maestro_apm, maestro_nombre, maestro_usuario, maestro_clave, maestro_nivel'
    )
    .eq('maestro_usuario', u)
    .in('maestro_nivel', cfg.nivelesEscolares)
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
      nivelSlug: cfg.slug,
    }
  }

  const { data: admins } = await db
    .from('usuario')
    .select(
      'usuario_id, perfil_id, usuario_app, usuario_apm, usuario_nombre, usuario_username, usuario_password, usuario_status, nivel'
    )
    .eq('usuario_username', u)
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
      role: rolDesdePerfilNivel(perfil, cfg),
      perfil,
      id: Number(a.usuario_id),
      nombre: nombre || u,
      usuario: u,
      exp: Date.now() + 12 * 60 * 60 * 1000,
      nivelSlug: cfg.slug,
    }
  }

  return null
}

export async function requireRacNivelSession(cfg: RacNivelConfig, req?: Request): Promise<RacSesionNivel> {
  let session: RacSesionNivel | null = null
  if (req) session = cookieRacNivelDesdeHeader(cfg, req.headers.get('cookie'))
  else {
    const jar = await cookies()
    session = decodeRacNivelSession(jar.get(cfg.cookieAuth)?.value)
  }
  if (!session || session.nivelSlug !== cfg.slug) throw new RacNivelAuthError('No autenticado')
  return session
}

export function jsonRacNivelError(err: unknown, fallback = 500) {
  if (err instanceof RacNivelAuthError) {
    return { error: err.message, status: err.status }
  }
  return { error: err instanceof Error ? err.message : String(err), status: fallback }
}

export function cfgDesdeRequestSlug(slug: string): RacNivelConfig {
  const cfg = racConfigDeSlug(slug)
  if (!cfg || !esRacNivelSlug(slug)) throw new RacNivelAuthError('Nivel no válido', 400)
  return cfg
}
