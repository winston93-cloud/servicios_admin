import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { ACCESOS_USUARIOS_PERMITIDOS } from '@/lib/accesos/accesosTypes'

export const ACCESOS_COOKIE = 'accesos_boveda'
const DURACION_MS = 30 * 60 * 1000
const MAX_INTENTOS = 5
const BLOQUEO_MS = 5 * 60 * 1000

export class AccesosError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

let clavesCache: { cifrado: Buffer; firma: Buffer } | null = null

function claves() {
  if (clavesCache) return clavesCache
  const secret = process.env.ACCESOS_VAULT_SECRET?.trim()
  if (!secret) throw new AccesosError('Falta configurar ACCESOS_VAULT_SECRET en el servidor.', 500)
  clavesCache = {
    cifrado: scryptSync(secret, 'accesos-cifrado-v1', 32),
    firma: scryptSync(secret, 'accesos-firma-v1', 32),
  }
  return clavesCache
}

export function cifrarPassword(texto: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', claves().cifrado, iv)
  const data = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')
}

export function descifrarPassword(payload: string): string {
  const buf = Buffer.from(payload, 'base64')
  if (buf.length < 29) throw new AccesosError('La contraseña guardada está dañada.', 500)
  const decipher = createDecipheriv('aes-256-gcm', claves().cifrado, buf.subarray(0, 12))
  decipher.setAuthTag(buf.subarray(12, 28))
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8')
}

type Boveda = { uid: number; nombre: string; exp: number }

function firmar(payload: string) {
  return createHmac('sha256', claves().firma).update(payload).digest('base64url')
}

function tokenBoveda(b: Boveda): string {
  const payload = Buffer.from(JSON.stringify(b), 'utf8').toString('base64url')
  return `${payload}.${firmar(payload)}`
}

function leerToken(token: string | undefined): Boveda | null {
  if (!token) return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const a = Buffer.from(sig)
  const b = Buffer.from(firmar(payload))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Boveda
    if (!s?.uid || !s.exp || s.exp < Date.now()) return null
    return s
  } catch {
    return null
  }
}

function cookieDe(request: Request): string | undefined {
  const m = (request.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${ACCESOS_COOKIE}=([^;]*)`))
  return m?.[1] ? decodeURIComponent(m[1]) : undefined
}

function opcionesCookie(valor: string, maxAgeSeg: number) {
  return {
    name: ACCESOS_COOKIE,
    value: valor,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/accesos',
    maxAge: maxAgeSeg,
  }
}

export function ponerCookieBoveda(res: NextResponse, b: Boveda) {
  res.cookies.set(opcionesCookie(tokenBoveda(b), Math.floor((b.exp - Date.now()) / 1000)))
}

export function quitarCookieBoveda(res: NextResponse) {
  res.cookies.set(opcionesCookie('', 0))
}

type Autorizado = { ok: true; uid: number; nombre: string; exp: number } | { ok: false; response: NextResponse }

function denegar(error: string, status: number, extra?: Record<string, unknown>): { ok: false; response: NextResponse } {
  return { ok: false, response: NextResponse.json({ error, ...extra }, { status }) }
}

/** Sesión de portal de un usuario permitido (sin exigir la bóveda abierta). */
export function requireUsuarioAccesos(request: Request): { ok: true; uid: number; nombre: string } | { ok: false; response: NextResponse } {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth
  const uid = Number(auth.session.usuario_id) || 0
  if (!ACCESOS_USUARIOS_PERMITIDOS.includes(uid)) return denegar('No tienes permiso para Accesos Autorizados.', 403)
  return { ok: true, uid, nombre: auth.session.displayName || auth.session.usuario_username || `Usuario ${uid}` }
}

/** Exige además la bóveda abierta (cookie firmada tras reingresar la contraseña del portal). */
export function requireBovedaAbierta(request: Request): Autorizado {
  const u = requireUsuarioAccesos(request)
  if (!u.ok) return u
  try {
    const b = leerToken(cookieDe(request))
    if (!b || b.uid !== u.uid) return denegar('La bóveda está cerrada. Escribe tu contraseña para abrirla.', 401, { cerrada: true })
    return { ok: true, uid: b.uid, nombre: b.nombre, exp: b.exp }
  } catch (e) {
    if (e instanceof AccesosError) return denegar(e.message, e.status)
    throw e
  }
}

export function estadoBoveda(request: Request, uid: number): Boveda | null {
  const b = leerToken(cookieDe(request))
  return b && b.uid === uid ? b : null
}

const intentos = new Map<number, { fallos: number; hasta: number }>()

function coincidePassword(guardada: string, escrita: string): boolean {
  if (!guardada || !escrita) return false
  const md5 = createHash('md5').update(escrita, 'utf8').digest('hex')
  const cmp = (x: string, y: string) => {
    const a = Buffer.from(x)
    const b = Buffer.from(y)
    return a.length === b.length && timingSafeEqual(a, b)
  }
  return cmp(guardada, escrita) || cmp(guardada.toLowerCase(), md5)
}

/** Verifica la contraseña del portal del usuario y devuelve la bóveda abierta. */
export async function abrirBoveda(uid: number, nombre: string, password: string): Promise<Boveda> {
  const reg = intentos.get(uid)
  if (reg && reg.hasta > Date.now()) {
    const min = Math.ceil((reg.hasta - Date.now()) / 60000)
    throw new AccesosError(`Demasiados intentos. Espera ${min} min y vuelve a intentar.`, 429)
  }
  const { data, error } = await createDbAdmin()
    .from('usuario')
    .select('usuario_password')
    .eq('usuario_id', uid)
    .maybeSingle()
  if (error) throw new AccesosError('No se pudo verificar la contraseña.', 500)
  const guardada = String((data as { usuario_password?: string } | null)?.usuario_password ?? '')
  if (!coincidePassword(guardada, password.trim())) {
    const fallos = (reg && reg.hasta <= Date.now() && reg.fallos >= MAX_INTENTOS ? 0 : reg?.fallos ?? 0) + 1
    intentos.set(uid, { fallos, hasta: fallos >= MAX_INTENTOS ? Date.now() + BLOQUEO_MS : 0 })
    throw new AccesosError('La contraseña no es correcta. Es la misma con la que entras al portal.', 401)
  }
  intentos.delete(uid)
  return { uid, nombre, exp: Date.now() + DURACION_MS }
}
