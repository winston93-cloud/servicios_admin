import type { AuthSession } from '@/lib/portalAuthService'
import { normalizarSesion } from '@/lib/portalAuthService'
const PORTAL_SESSION_HEADER = 'x-portal-session'

export function parsePortalSessionHeader(raw: string | null): AuthSession | null {
  if (!raw) return null
  try {
    return normalizarSesion(JSON.parse(raw) as unknown)
  } catch {
    /* sesión inválida */
  }
  return null
}

export function readPortalSessionForFetch(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem('portal_auth_session')
  } catch {
    return null
  }
}

export function portalSessionHeaderName(): string {
  return PORTAL_SESSION_HEADER
}

export function requireInsforgeAdminEnv() {
  const baseUrl =
    process.env.NEXT_PUBLIC_INSFORGE_URL ?? process.env.INSFORGE_URL
  const apiKey = process.env.INSFORGE_API_KEY
  if (!baseUrl || !apiKey) {
    throw new Error('Faltan NEXT_PUBLIC_INSFORGE_URL e INSFORGE_API_KEY.')
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
}

/** Tablas que solo se tocan desde sus APIs dedicadas (con su propia autorización). */
const TABLAS_SOLO_SERVIDOR = ['acceso_autorizado', 'pago_interno_bitacora', 'pago_interno_intento']

/**
 * 2026-10-12 - Seguridad: el proxy usa la API key de administrador (se salta RLS), así que solo el personal
 * (`role: usuario`) puede consultar la base libremente. Una sesión de familia solo puede LEER estas tablas,
 * que son las únicas que piden sus pantallas desde el navegador (el resto va por APIs del servidor).
 */
const TABLAS_LECTURA_FAMILIA = new Set(['ciclos_escolares'])

/** Tabla de `/api/database/records/<tabla>`; null en RPC u otras rutas. */
export function tablaDeRuta(upstreamPath: string): string | null {
  const m = upstreamPath.match(/^\/api\/database\/records\/([^/?]+)/)
  return m ? decodeURIComponent(m[1]).toLowerCase() : null
}

export function familiaPuedeUsarProxy(upstreamPath: string, method: string): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false
  const tabla = tablaDeRuta(upstreamPath)
  return tabla != null && TABLAS_LECTURA_FAMILIA.has(tabla)
}

/** `session` debe venir de la cookie firmada (`sesionPortalDeRequest`), nunca del header. */
export async function proxyInsforgeDatabaseRequest(
  request: Request,
  upstreamPath: string,
  session: AuthSession | null,
  env: { baseUrl: string; apiKey: string } = requireInsforgeAdminEnv()
): Promise<Response> {
  if (!session) {
    return Response.json(
      { message: 'Sesión requerida. Inicia sesión de nuevo.' },
      { status: 401 }
    )
  }

  if (session.role !== 'usuario' && !familiaPuedeUsarProxy(upstreamPath, request.method)) {
    console.warn('[proxy-db] bloqueado para sesión no personal', {
      role: session.role,
      alumno_ref: session.alumno_ref ?? null,
      method: request.method,
      path: upstreamPath,
    })
    return Response.json(
      { message: 'Esta información es solo para personal del colegio.' },
      { status: 403 }
    )
  }

  const { baseUrl, apiKey } = env
  const incoming = new URL(request.url)
  const pedido = decodeURIComponent(`${upstreamPath}${incoming.search}`).toLowerCase()
  if (TABLAS_SOLO_SERVIDOR.some((t) => pedido.includes(t))) {
    return Response.json({ message: 'Recurso no disponible.' }, { status: 403 })
  }
  const target = `${baseUrl}${upstreamPath}${incoming.search}`

  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  if (contentType) headers.set('Content-Type', contentType)
  const prefer = request.headers.get('prefer')
  if (prefer) headers.set('Prefer', prefer)
  const range = request.headers.get('range')
  if (range) headers.set('Range', range)
  headers.set('Authorization', `Bearer ${apiKey}`)
  headers.set('apikey', apiKey)

  const method = request.method
  const body =
    method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer()

  const upstream = await fetch(target, { method, headers, body })

  const responseHeaders = new Headers()
  const passHeaders = ['content-type', 'content-range', 'preference-applied']
  for (const name of passHeaders) {
    const value = upstream.headers.get(name)
    if (value) responseHeaders.set(name, value)
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}
