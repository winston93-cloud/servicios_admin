import { NextResponse } from 'next/server'
import {
  clavePosValida,
  cookiePosValida,
  opcionesCookiePos,
  POS_AUTH_COOKIE,
} from '@/lib/posAuth'

export const runtime = 'nodejs'

/** Comprueba si ya hay sesión de acceso al POS. */
export async function GET(request: Request) {
  if (cookiePosValida(request.headers.get('cookie'))) {
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ ok: false }, { status: 401 })
}

/** Valida solo la contraseña y deja cookie HttpOnly. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const clave = String(
      (body as { clave?: string; password?: string }).clave ??
        (body as { password?: string }).password ??
        ''
    )

    if (!clavePosValida(clave)) {
      return NextResponse.json(
        { ok: false, error: 'Contraseña incorrecta.' },
        { status: 401 }
      )
    }

    const res = NextResponse.json({ ok: true })
    const opt = opcionesCookiePos()
    res.cookies.set(opt.name, opt.value, {
      httpOnly: opt.httpOnly,
      secure: opt.secure,
      sameSite: opt.sameSite,
      path: opt.path,
      maxAge: opt.maxAge,
    })
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error de autenticación'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

/** Cierra la sesión del POS (borra cookie). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(POS_AUTH_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
