import { createHmac, timingSafeEqual } from 'crypto'
import {
  nivelSsoQrEntrada,
  urlQrEntradaApp,
} from '@/lib/dashboardModulosConfig'

export {
  puedeSsoQrEntrada,
  QR_ENTRADA_SSO_USUARIOS,
  urlLoginQrEntrada,
} from '@/lib/dashboardModulosConfig'

const TTL_MS = 2 * 60 * 1000
const PREFIJO = 'qr-entrada-sso-v1.'

function secreto(): string {
  const s = (process.env.QR_TOKEN_SECRET ?? '').trim()
  if (!s) throw new Error('Falta QR_TOKEN_SECRET para firmar el acceso a registro QR.')
  return s
}

function firmar(payloadB64: string): string {
  return createHmac('sha256', secreto()).update(PREFIJO + payloadB64).digest('base64url')
}

export function crearTokenSsoQrEntrada(opts: {
  usuarioId: number
  username: string
  displayName: string
}): string {
  const payload = {
    v: 1,
    uid: opts.usuarioId,
    u: opts.username,
    n: opts.displayName,
    rol: 'admin' as const,
    dest: '/admin',
    nivel: nivelSsoQrEntrada(opts.usuarioId),
    exp: Date.now() + TTL_MS,
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${payloadB64}.${firmar(payloadB64)}`
}

export function urlSsoQrEntrada(token: string): string {
  return `${urlQrEntradaApp()}/sso?t=${encodeURIComponent(token)}`
}

/** Solo tests internos; no se usa en el cliente. */
export function tokenSsoQrEntradaValido(token: string): boolean {
  const [payloadB64, sig] = token.split('.')
  if (!payloadB64 || !sig) return false
  const esperado = firmar(payloadB64)
  const a = Buffer.from(sig)
  const b = Buffer.from(esperado)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  try {
    const raw = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { exp?: number }
    return Boolean(raw?.exp && raw.exp > Date.now())
  } catch {
    return false
  }
}
