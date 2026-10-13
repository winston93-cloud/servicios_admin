import { NextResponse } from 'next/server'
import { autenticarBoletas, encodeBoletasSession, opcionesCookieBoletas } from '@/lib/boletasAuth'
import { equipoDeTeacher } from '@/lib/teamEnglish/teService'
import { TE_SIM_COOKIE, cookiesSalida, sesionTeacherDeRequest } from '@/lib/teamEnglish/teTeacherAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { usuario?: string; password?: string }
    const session = await autenticarBoletas(String(body.usuario ?? ''), String(body.password ?? ''))
    if (!session || session.role !== 'maestro') {
      await new Promise((r) => setTimeout(r, 800))
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 })
    }
    if (!(await equipoDeTeacher(session.id))) {
      return NextResponse.json({ error: 'Tu usuario no está en un equipo de inglés. Avisa a tu directora.' }, { status: 403 })
    }
    const res = NextResponse.json({ ok: true })
    res.cookies.set(opcionesCookieBoletas(encodeBoletasSession(session)))
    res.cookies.set({ name: TE_SIM_COOKIE, value: '', path: '/', maxAge: 0 })
    return res
  } catch (e) {
    console.error('POST /api/team-english/teacher/login:', e)
    return NextResponse.json({ error: 'No se pudo iniciar sesión.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const res = NextResponse.json({ ok: true })
  for (const c of cookiesSalida(sesionTeacherDeRequest(request))) res.cookies.set(c)
  return res
}
