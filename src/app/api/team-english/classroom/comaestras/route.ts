import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { TeError, equipo, resolverNivel } from '@/lib/teamEnglish/teService'
import { sincronizarCoMaestras } from '@/lib/teamEnglish/teClassroom'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json().catch(() => ({}))) as { nivel?: unknown }
    const nivel = resolverNivel(auth.session.usuario_id, body.nivel)
    const emails = (await equipo(nivel, false)).map((t) => t.email).filter((e): e is string => !!e)
    const r = await sincronizarCoMaestras(emails)
    if (r.agregadas || r.quitadas || r.errores.length) console.info('Team English co-maestras', r)
    return NextResponse.json(r)
  } catch (e) {
    if (e instanceof TeError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('POST /api/team-english/classroom/comaestras:', e)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}
