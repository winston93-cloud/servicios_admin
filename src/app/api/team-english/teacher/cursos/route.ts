import { NextResponse } from 'next/server'
import { cookieBoletasDesdeHeader } from '@/lib/boletasAuth'
import { TeError, eliminarCursoTeacher, equipoDeTeacher, guardarCursoTeacher, portalTeacher } from '@/lib/teamEnglish/teService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sesionTeacher(request: Request) {
  const s = cookieBoletasDesdeHeader(request.headers.get('cookie'))
  if (!s || s.role !== 'maestro') throw new TeError('Inicia sesión con tu usuario de teacher.', 401)
  return s
}

function responderError(e: unknown, ctx: string) {
  if (e instanceof TeError) return NextResponse.json({ error: e.message }, { status: e.status })
  console.error(ctx, e)
  return NextResponse.json({ error: e instanceof Error ? e.message : 'Error inesperado' }, { status: 500 })
}

export async function POST(request: Request) {
  try {
    const s = sesionTeacher(request)
    const r = await equipoDeTeacher(s.id)
    if (!r) throw new TeError('Tu usuario no está en un equipo de inglés.', 403)
    await guardarCursoTeacher(r.nivel, s.id, await request.formData())
    return NextResponse.json(await portalTeacher(s.id))
  } catch (e) {
    return responderError(e, 'POST /api/team-english/teacher/cursos:')
  }
}

export async function DELETE(request: Request) {
  try {
    const s = sesionTeacher(request)
    const id = Number(new URL(request.url).searchParams.get('id'))
    if (!Number.isInteger(id) || id <= 0) throw new TeError('Curso no válido.')
    await eliminarCursoTeacher(s.id, id)
    return NextResponse.json(await portalTeacher(s.id))
  } catch (e) {
    return responderError(e, 'DELETE /api/team-english/teacher/cursos:')
  }
}
