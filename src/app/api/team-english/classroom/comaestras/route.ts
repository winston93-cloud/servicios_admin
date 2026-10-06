import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { TeError, equipo, gestionaClassroom, resolverNivel } from '@/lib/teamEnglish/teService'
import { aplicarCoMaestra, planCoMaestras } from '@/lib/teamEnglish/teClassroom'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function responderError(e: unknown, ctx: string) {
  if (e instanceof TeError) return NextResponse.json({ error: e.message }, { status: e.status })
  console.error(ctx, e)
  return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
}

function autorizar(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return { ok: false as const, response: auth.response }
  if (!gestionaClassroom(auth.session.usuario_id)) {
    return { ok: false as const, response: NextResponse.json({ error: 'No tienes permiso para esta acción.' }, { status: 403 }) }
  }
  return { ok: true as const, auth }
}

export async function GET(request: Request) {
  const a = autorizar(request)
  if (!a.ok) return a.response
  try {
    const nivel = resolverNivel(a.auth.session.usuario_id, new URL(request.url).searchParams.get('nivel'))
    const teachers = (await equipo(nivel, false)).map((t) => ({ nombre: t.nombre, email: t.email }))
    return NextResponse.json(await planCoMaestras(teachers))
  } catch (e) {
    return responderError(e, 'GET /api/team-english/classroom/comaestras:')
  }
}

export async function POST(request: Request) {
  const a = autorizar(request)
  if (!a.ok) return a.response
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: unknown; cursos?: unknown; quitar?: unknown }
    const cursos = Array.isArray(body.cursos) ? body.cursos.map(String) : []
    const r = await aplicarCoMaestra(body.email, cursos, body.quitar === true)
    console.info('Team English co-maestra', { por: a.auth.session.usuario_id, email: body.email, quitar: body.quitar === true, ok: r.ok, errores: r.errores.length })
    return NextResponse.json(r)
  } catch (e) {
    return responderError(e, 'POST /api/team-english/classroom/comaestras:')
  }
}
