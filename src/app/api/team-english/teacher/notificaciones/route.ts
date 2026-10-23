import { NextResponse } from 'next/server'
import { TeError } from '@/lib/teamEnglish/teService'
import { marcarNotificacionTeacher, notificacionesTeacher } from '@/lib/teamEnglish/teNotificaciones'
import { requireSesionTeacher } from '@/lib/teamEnglish/teTeacherAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function responderError(e: unknown, ctx: string) {
  if (e instanceof TeError) return NextResponse.json({ error: e.message }, { status: e.status })
  console.error(ctx, e)
  return NextResponse.json({ error: e instanceof Error ? e.message : 'Error inesperado' }, { status: 500 })
}

export async function GET(request: Request) {
  try {
    const s = requireSesionTeacher(request)
    const rows = await notificacionesTeacher(s.id)
    return NextResponse.json({ ok: true, rows, simulado: !!s.simuladoPor })
  } catch (e) {
    return responderError(e, 'GET /api/team-english/teacher/notificaciones:')
  }
}

/** En vista previa la directora no le cierra los avisos a la teacher. */
export async function PATCH(request: Request) {
  try {
    const s = requireSesionTeacher(request)
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown }
    const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0) : []
    if (!s.simuladoPor) await marcarNotificacionTeacher(s.id, ids)
    return NextResponse.json({ ok: true, simulado: !!s.simuladoPor })
  } catch (e) {
    return responderError(e, 'PATCH /api/team-english/teacher/notificaciones:')
  }
}
