import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { TeError, accion, nivelesPermitidos, resolverNivel, snapshot } from '@/lib/teamEnglish/teService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function responderError(e: unknown, ctx: string) {
  if (e instanceof TeError) return NextResponse.json({ error: e.message }, { status: e.status })
  console.error(ctx, e)
  return NextResponse.json({ error: e instanceof Error ? e.message : 'Error inesperado' }, { status: 500 })
}

export async function GET(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  try {
    const nivel = resolverNivel(auth.session.usuario_id, new URL(request.url).searchParams.get('nivel'))
    return NextResponse.json(await snapshot(nivel, nivelesPermitidos(auth.session.usuario_id)))
  } catch (e) {
    return responderError(e, 'GET /api/team-english:')
  }
}

export async function POST(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const nivel = resolverNivel(auth.session.usuario_id, body.nivel)
    const quien = auth.session.displayName?.trim() || auth.session.usuario_username || 'Dirección'
    return NextResponse.json(await accion(nivel, body, quien))
  } catch (e) {
    return responderError(e, 'POST /api/team-english:')
  }
}
