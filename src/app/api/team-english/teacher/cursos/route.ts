import { NextResponse } from 'next/server'
import { TeError, eliminarCursoTeacher, equipoDeTeacher, guardarCursoTeacher, portalTeacher } from '@/lib/teamEnglish/teService'
import { requireSesionTeacher } from '@/lib/teamEnglish/teTeacherAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function responderError(e: unknown, ctx: string) {
  if (e instanceof TeError) return NextResponse.json({ error: e.message }, { status: e.status })
  console.error(ctx, e)
  return NextResponse.json({ error: e instanceof Error ? e.message : 'Error inesperado' }, { status: 500 })
}

export async function POST(request: Request) {
  try {
    const s = requireSesionTeacher(request)
    const r = await equipoDeTeacher(s.id)
    if (!r) throw new TeError('Tu usuario no está en un equipo de inglés.', 403)
    await guardarCursoTeacher(r.nivel, s.id, await request.formData())
    return NextResponse.json({ ...(await portalTeacher(s.id)), simulado_por: s.simuladoPor })
  } catch (e) {
    return responderError(e, 'POST /api/team-english/teacher/cursos:')
  }
}

export async function DELETE(request: Request) {
  try {
    const s = requireSesionTeacher(request)
    const id = Number(new URL(request.url).searchParams.get('id'))
    if (!Number.isInteger(id) || id <= 0) throw new TeError('Curso no válido.')
    await eliminarCursoTeacher(s.id, id)
    return NextResponse.json({ ...(await portalTeacher(s.id)), simulado_por: s.simuladoPor })
  } catch (e) {
    return responderError(e, 'DELETE /api/team-english/teacher/cursos:')
  }
}
