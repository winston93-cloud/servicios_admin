import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { TeError, nivelesPermitidos } from '@/lib/teamEnglish/teService'
import { resumenClassroomTeacher } from '@/lib/teamEnglish/teClassroom'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  if (!nivelesPermitidos(auth.session.usuario_id).length) {
    return NextResponse.json({ error: 'No tienes acceso a Team English.' }, { status: 403 })
  }
  try {
    const email = new URL(request.url).searchParams.get('email')
    return NextResponse.json(await resumenClassroomTeacher(email))
  } catch (e) {
    if (e instanceof TeError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('GET /api/team-english/classroom:', e)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}
