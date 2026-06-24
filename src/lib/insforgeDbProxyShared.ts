import type { AuthSession } from '@/lib/portalAuthService'
import { requireDesayunosAdminEnv } from '@/lib/desayunosInsforge'

const PORTAL_SESSION_HEADER = 'x-portal-session'

export function parsePortalSessionHeader(raw: string | null): AuthSession | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as AuthSession
    if (parsed?.role === 'alumno' || parsed?.role === 'usuario') return parsed
  } catch {
    /* sesión inválida */
  }
  return null
}

export function readPortalSessionForFetch(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem('portal_auth_session')
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

export async function proxyInsforgeDatabaseRequest(
  request: Request,
  upstreamPath: string,
  env: { baseUrl: string; apiKey: string } = requireInsforgeAdminEnv()
): Promise<Response> {
  const session = parsePortalSessionHeader(request.headers.get(PORTAL_SESSION_HEADER))
  if (!session) {
    return Response.json(
      { message: 'Sesión requerida. Inicia sesión de nuevo.' },
      { status: 401 }
    )
  }

  const { baseUrl, apiKey } = env
  const incoming = new URL(request.url)
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

export async function proxyDesayunosDatabaseRequest(
  request: Request,
  upstreamPath: string
): Promise<Response> {
  return proxyInsforgeDatabaseRequest(request, upstreamPath, requireDesayunosAdminEnv())
}
