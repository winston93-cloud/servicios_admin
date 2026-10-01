import { NextResponse } from 'next/server'
import { cookieBoletasDesdeHeader } from '@/lib/boletasAuth'
import { TeError, equipoDeTeacher, guardarPlaneacion, portalTeacher } from '@/lib/teamEnglish/teService'

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

export async function GET(request: Request) {
  try {
    const s = sesionTeacher(request)
    return NextResponse.json(await portalTeacher(s.id))
  } catch (e) {
    return responderError(e, 'GET /api/team-english/teacher:')
  }
}

export async function POST(request: Request) {
  try {
    const s = sesionTeacher(request)
    const r = await equipoDeTeacher(s.id)
    if (!r) throw new TeError('Tu usuario no está en un equipo de inglés.', 403)
    const form = await request.formData()
    const file = form.get('archivo') instanceof File ? (form.get('archivo') as File) : null
    await guardarPlaneacion({
      nivel: r.nivel,
      maestroId: s.id,
      grado: form.get('grado'),
      semana: form.get('semana'),
      titulo: form.get('titulo'),
      notas: form.get('notas'),
      file,
      quien: s.nombre,
      rol: 'teacher',
    })
    return NextResponse.json(await portalTeacher(s.id))
  } catch (e) {
    return responderError(e, 'POST /api/team-english/teacher:')
  }
}
