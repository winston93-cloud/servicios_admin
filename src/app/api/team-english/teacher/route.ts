import { NextResponse } from 'next/server'
import { TeError, equipoDeTeacher, guardarPlaneacion, portalTeacher } from '@/lib/teamEnglish/teService'
import { quienSube, requireSesionTeacher } from '@/lib/teamEnglish/teTeacherAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Leer una planeación en PDF con IA puede tardar ~20-40 s. */
export const maxDuration = 60

function responderError(e: unknown, ctx: string) {
  if (e instanceof TeError) return NextResponse.json({ error: e.message }, { status: e.status })
  console.error(ctx, e)
  return NextResponse.json({ error: e instanceof Error ? e.message : 'Error inesperado' }, { status: 500 })
}

export async function GET(request: Request) {
  try {
    const s = requireSesionTeacher(request)
    return NextResponse.json({ ...(await portalTeacher(s.id)), simulado_por: s.simuladoPor })
  } catch (e) {
    return responderError(e, 'GET /api/team-english/teacher:')
  }
}

export async function POST(request: Request) {
  try {
    const s = requireSesionTeacher(request)
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
      contenido: form.get('contenido') ?? undefined,
      enviar: form.get('enviar') !== '0',
      file,
      quien: quienSube(s),
      rol: 'teacher',
    })
    return NextResponse.json({ ...(await portalTeacher(s.id)), simulado_por: s.simuladoPor })
  } catch (e) {
    return responderError(e, 'POST /api/team-english/teacher:')
  }
}
