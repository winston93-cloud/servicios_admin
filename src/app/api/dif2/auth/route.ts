import { NextResponse } from 'next/server'
import {
  claveReportePdfValida,
  cookieDif2Valida,
  opcionesCookieDif2,
} from '@/lib/reportes/reportePdfAuth'

export const runtime = 'nodejs'

/** Comprueba si ya hay sesión de acceso al reporte. */
export async function GET(request: Request) {
  if (cookieDif2Valida(request.headers.get('cookie'))) {
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

    if (!claveReportePdfValida(clave)) {
      return NextResponse.json(
        { ok: false, error: 'Contraseña incorrecta.' },
        { status: 401 }
      )
    }

    const res = NextResponse.json({ ok: true })
    const opt = opcionesCookieDif2()
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
