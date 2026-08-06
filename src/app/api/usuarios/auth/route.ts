import { NextResponse } from 'next/server'
import {
  cookieUsuariosValida,
  opcionesCookieUsuarios,
  pinUsuariosValido,
  USUARIOS_AUTH_COOKIE,
} from '@/lib/usuariosCatalogoAuth'

export const runtime = 'nodejs'

/** Comprueba si ya hay sesión de acceso al catálogo de usuarios. */
export async function GET(request: Request) {
  if (cookieUsuariosValida(request.headers.get('cookie'))) {
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ ok: false }, { status: 401 })
}

/** Valida el PIN y deja cookie HttpOnly. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const pin = String(
      (body as { pin?: string; clave?: string; password?: string }).pin ??
        (body as { clave?: string }).clave ??
        (body as { password?: string }).password ??
        ''
    )

    if (!pinUsuariosValido(pin)) {
      return NextResponse.json({ ok: false, error: 'PIN incorrecto.' }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true })
    const opt = opcionesCookieUsuarios()
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

/** Cierra la sesión del catálogo de usuarios. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(USUARIOS_AUTH_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
