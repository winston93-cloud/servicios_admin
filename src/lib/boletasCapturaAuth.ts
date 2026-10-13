import { createHmac, timingSafeEqual } from 'crypto'
import { createBoletasDb } from './boletasInsforge'
import { BoletasAuthError, md5Hex } from './boletasAuth'
import { normRacEmail } from './racStaffAllowlist'
import type { RacGoogleCandidate } from './racAuthGoogle'

/** Portal público de captura de boletas: maestros y teachers entran a sus grupos por nivel. */
export type BoletasCapturaSlug = 'maternal-kinder'

export type BoletasCapturaConfig = {
  slug: BoletasCapturaSlug
  titulo: string
  /** `maestro_nivel` que pueden entrar. */
  niveles: number[]
  cookie: string
}

export const BOLETAS_CAPTURA_NIVELES: Record<BoletasCapturaSlug, BoletasCapturaConfig> = {
  'maternal-kinder': {
    slug: 'maternal-kinder',
    titulo: 'Maternal / Kinder',
    niveles: [1, 2],
    cookie: 'boletas_captura_mk',
  },
}

export function capturaConfigDeSlug(slug: string): BoletasCapturaConfig {
  const cfg = BOLETAS_CAPTURA_NIVELES[slug as BoletasCapturaSlug]
  if (!cfg) {
    const err = new BoletasAuthError('Nivel no válido')
    err.status = 404
    throw err
  }
  return cfg
}

export type BoletasCapturaSesion = {
  maestroId: number
  nombre: string
  usuario: string
  /** Dirección (dg@, sistemas.desarrollo@, directoras): ve y captura todos los grupos del nivel. */
  supervisor?: boolean
  /** Solo supervisión: módulos que puede ver. Sin lista = todos. */
  supervisa?: string[]
  slug: BoletasCapturaSlug
  exp: number
}

const DURACION_MS = 12 * 60 * 60 * 1000

function secreto(): string {
  return (
    process.env.BOLETAS_SESSION_SECRET ||
    process.env.BOLETAS_INSFORGE_API_KEY ||
    process.env.INSFORGE_API_KEY ||
    'boletas-captura-dev-secret'
  )
}

function firmar(payloadB64: string): string {
  return createHmac('sha256', secreto()).update(`captura:${payloadB64}`).digest('base64url')
}

function codificar(s: BoletasCapturaSesion): string {
  const payloadB64 = Buffer.from(JSON.stringify(s), 'utf8').toString('base64url')
  return `${payloadB64}.${firmar(payloadB64)}`
}

function decodificar(token: string | null | undefined, cfg: BoletasCapturaConfig): BoletasCapturaSesion | null {
  if (!token) return null
  const [payloadB64, sig] = token.split('.')
  if (!payloadB64 || !sig) return null
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(firmar(payloadB64))
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const s = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as BoletasCapturaSesion
    if (!s?.maestroId || !s.exp || s.exp < Date.now() || s.slug !== cfg.slug) return null
    return s
  } catch {
    return null
  }
}

export function cookieSesionCaptura(cfg: BoletasCapturaConfig, s: Omit<BoletasCapturaSesion, 'exp' | 'slug'>) {
  return {
    name: cfg.cookie,
    value: codificar({ ...s, slug: cfg.slug, exp: Date.now() + DURACION_MS }),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: DURACION_MS / 1000,
  }
}

export function supervisaModulo(s: BoletasCapturaSesion, modulo: string): boolean {
  return Boolean(s.supervisor) && (!s.supervisa || s.supervisa.includes(modulo))
}

export function cookieSesionCapturaBorrar(cfg: BoletasCapturaConfig) {
  return { ...cookieSesionCaptura(cfg, { maestroId: 0, nombre: '', usuario: '' }), value: '', maxAge: 0 }
}

export function requireSesionCaptura(cfg: BoletasCapturaConfig, req: Request): BoletasCapturaSesion {
  const header = req.headers.get('cookie') ?? ''
  const match = header.match(new RegExp(`(?:^|;\\s*)${cfg.cookie}=([^;]*)`))
  let token: string | null = null
  try {
    token = match?.[1] ? decodeURIComponent(match[1]) : null
  } catch {
    token = null
  }
  const s = decodificar(token, cfg)
  if (!s) throw new BoletasAuthError('Tu sesión terminó. Vuelve a entrar.')
  return s
}

function nombreDe(m: Record<string, unknown>): string {
  return [m.maestro_nombre, m.maestro_app, m.maestro_apm]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

function claveCoincide(guardada: unknown, plana: string): boolean {
  const s = String(guardada ?? '')
  if (!s) return false
  return s === plana || s.toLowerCase() === md5Hex(plana).toLowerCase()
}

const COLS_MAESTRO =
  'maestro_id, maestro_app, maestro_apm, maestro_nombre, maestro_usuario, maestro_clave, maestro_email, maestro_nivel, maestro_idioma'

export async function autenticarCaptura(
  cfg: BoletasCapturaConfig,
  usuario: string,
  clave: string
): Promise<Omit<BoletasCapturaSesion, 'exp' | 'slug'> | null> {
  const u = usuario.trim()
  if (!u || !clave) return null
  const { data, error } = await createBoletasDb()
    .from('boleta_maestro')
    .select(COLS_MAESTRO)
    .ilike('maestro_usuario', u)
    .in('maestro_nivel', cfg.niveles)
    .limit(20)
  if (error) throw new Error(error.message)
  const m = ((data ?? []) as Record<string, unknown>[]).find(
    (r) => String(r.maestro_usuario ?? '').trim().toLowerCase() === u.toLowerCase()
  )
  if (!m || !claveCoincide(m.maestro_clave, clave)) return null
  return { maestroId: Number(m.maestro_id), nombre: nombreDe(m) || u, usuario: u }
}

function etiquetaIdioma(idioma: unknown): string {
  if (idioma === 'en') return 'Teacher (inglés)'
  if (idioma === 'es') return 'Maestra (español)'
  return 'Docente'
}

export async function candidatosCapturaPorEmail(
  cfg: BoletasCapturaConfig,
  emailRaw: string
): Promise<RacGoogleCandidate[]> {
  const email = normRacEmail(emailRaw)
  if (!email) return []
  const { data, error } = await createBoletasDb()
    .from('boleta_maestro')
    .select(COLS_MAESTRO)
    .ilike('maestro_email', email)
    .in('maestro_nivel', cfg.niveles)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[])
    .filter((m) => normRacEmail(String(m.maestro_email ?? '')) === email)
    .map((m) => {
      const usuario = String(m.maestro_usuario ?? '').trim()
      return {
        tipo: 'maestro' as const,
        id: Number(m.maestro_id),
        role: 'maestro',
        perfil: 1,
        nombre: nombreDe(m) || usuario || email,
        usuario,
        etiquetaRol: etiquetaIdioma(m.maestro_idioma),
      }
    })
}
