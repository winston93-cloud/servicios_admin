import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

export const SAT_MODULO_COOKIE = 'sat_modulo_session'
const TTL_MS = 12 * 60 * 60 * 1000

function secretSesion(): string {
  const s =
    process.env.SAT_MODULO_SESSION_SECRET?.trim() ||
    process.env.INSFORGE_API_KEY?.trim()
  if (!s) {
    throw new Error(
      'Falta SAT_MODULO_SESSION_SECRET o INSFORGE_API_KEY para sesión del módulo SAT.'
    )
  }
  return s
}

function credencialesSatModulo(): { usuario: string; clave: string } {
  return {
    usuario: (process.env.SAT_MODULO_USUARIO ?? 'laura').trim().toLowerCase(),
    clave: process.env.SAT_MODULO_CLAVE ?? 'encript@da',
  }
}

function firmar(payload: string): string {
  return createHmac('sha256', secretSesion()).update(payload).digest('base64url')
}

export function validarCredencialesSatModulo(
  usuario: string,
  clave: string
): boolean {
  const esperado = credencialesSatModulo()
  const u = usuario.trim().toLowerCase()
  if (u !== esperado.usuario) return false
  if (clave !== esperado.clave) return false
  return true
}

export function crearTokenSatModulo(usuario: string): string {
  const payload = Buffer.from(
    JSON.stringify({ u: usuario.trim().toLowerCase(), exp: Date.now() + TTL_MS })
  ).toString('base64url')
  return `${payload}.${firmar(payload)}`
}

export function verificarTokenSatModulo(
  token: string | null | undefined
): { usuario: string } | null {
  if (!token) return null
  const [payload, firma] = token.split('.')
  if (!payload || !firma) return null
  const esperada = firmar(payload)
  try {
    const a = Buffer.from(firma)
    const b = Buffer.from(esperada)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      u?: string
      exp?: number
    }
    if (!data.u || typeof data.exp !== 'number' || data.exp < Date.now()) return null
    return { usuario: data.u }
  } catch {
    return null
  }
}

export function tokenSatModuloDesdeRequest(request: Request): string | null {
  const cookie = request.headers.get('cookie') ?? ''
  const match = cookie.match(
    new RegExp(`(?:^|;\\s*)${SAT_MODULO_COOKIE}=([^;]+)`)
  )
  if (!match?.[1]) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export function sesionSatModuloDesdeRequest(
  request: Request
): { usuario: string } | null {
  return verificarTokenSatModulo(tokenSatModuloDesdeRequest(request))
}

export function requireSatModuloSesion(
  request: Request
): { ok: true; usuario: string } | { ok: false; response: NextResponse } {
  const sesion = sesionSatModuloDesdeRequest(request)
  if (!sesion) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Debe iniciar sesión en el módulo SAT.' },
        { status: 401 }
      ),
    }
  }
  return { ok: true, usuario: sesion.usuario }
}

export function opcionesCookieSatModulo(): {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax'
  path: string
  maxAge: number
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(TTL_MS / 1000),
  }
}
