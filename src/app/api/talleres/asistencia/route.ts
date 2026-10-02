import { NextResponse } from 'next/server'
import { parsePortalSessionHeader, portalSessionHeaderName } from '@/lib/insforgeDbProxyShared'
import { TalleresError } from '@/lib/talleres/talleresService'
import { asistenciaDelDia, guardarAsistencia, guardarIncidencia } from '@/lib/talleres/talleresAsistenciaService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Pública: el personal de estancia pasa lista sin iniciar sesión.

function responderError(e: unknown, contexto: string) {
  if (e instanceof TalleresError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error(contexto, e)
  return NextResponse.json({ error: 'Error inesperado. Intenta de nuevo.' }, { status: 500 })
}

export async function GET(request: Request) {
  try {
    const fecha = new URL(request.url).searchParams.get('fecha')
    return NextResponse.json(await asistenciaDelDia(fecha), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    return responderError(e, 'GET /api/talleres/asistencia:')
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const session = parsePortalSessionHeader(request.headers.get(portalSessionHeaderName()))
    if (session?.role === 'usuario' && session.displayName) body.registrado_por = session.displayName
    if (body.accion === 'incidencia') {
      return NextResponse.json({ ok: true, incidencia: await guardarIncidencia(body) })
    }
    return NextResponse.json({ ok: true, registro: await guardarAsistencia(body) })
  } catch (e) {
    return responderError(e, 'POST /api/talleres/asistencia:')
  }
}
