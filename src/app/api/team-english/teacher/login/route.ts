import { NextResponse } from 'next/server'
import { BOLETAS_AUTH_COOKIE, autenticarBoletas, encodeBoletasSession, opcionesCookieBoletas } from '@/lib/boletasAuth'
import { equipoDeTeacher } from '@/lib/teamEnglish/teService'

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
    return res
  } catch (e) {
    console.error('POST /api/team-english/teacher/login:', e)
    return NextResponse.json({ error: 'No se pudo iniciar sesión.' }, { status: 500 })
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set({ name: BOLETAS_AUTH_COOKIE, value: '', path: '/', maxAge: 0 })
  return res
}
