import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { TeError, equipo, resolverNivel } from '@/lib/teamEnglish/teService'
import { resumenClassroomTeacher } from '@/lib/teamEnglish/teClassroom'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  try {
    const params = new URL(request.url).searchParams
    const nivel = resolverNivel(auth.session.usuario_id, params.get('nivel'))
    const maestroId = Number(params.get('maestro_id'))
    const teacher = (await equipo(nivel)).find((t) => t.maestro_id === maestroId)
    if (!teacher) throw new TeError('Esa teacher no está en el equipo.', 404)
    if (!teacher.email) throw new TeError('La teacher no tiene correo registrado.', 422)
    return NextResponse.json(await resumenClassroomTeacher(teacher.email))
  } catch (e) {
    if (e instanceof TeError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('GET /api/team-english/classroom:', e)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}
