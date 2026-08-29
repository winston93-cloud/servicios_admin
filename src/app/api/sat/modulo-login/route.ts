import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  crearTokenSatModulo,
  opcionesCookieSatModulo,
  SAT_MODULO_COOKIE,
  sesionSatModuloDesdeRequest,
  validarCredencialesSatModulo,
} from '@/lib/sat/satModuloAuth'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      usuario?: string
      clave?: string
    }
    const usuario = String(body.usuario ?? '').trim()
    const clave = String(body.clave ?? '')

    if (!usuario || !clave) {
      return NextResponse.json(
        { ok: false, error: 'Usuario y clave requeridos.' },
        { status: 400 }
      )
    }

    if (!validarCredencialesSatModulo(usuario, clave)) {
      return NextResponse.json(
        { ok: false, error: 'Usuario o clave incorrectos.' },
        { status: 401 }
      )
    }

    const token = crearTokenSatModulo(usuario)
    const jar = await cookies()
    jar.set(SAT_MODULO_COOKIE, token, opcionesCookieSatModulo())

    return NextResponse.json({
      ok: true,
      usuario: usuario.trim().toLowerCase(),
    })
  } catch (e) {
    console.error('sat/modulo-login:', e)
    return NextResponse.json(
      { ok: false, error: 'No se pudo iniciar sesión.' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  const sesion = sesionSatModuloDesdeRequest(request)
  if (!sesion) {
    return NextResponse.json({ ok: false, autenticado: false }, { status: 401 })
  }
  return NextResponse.json({
    ok: true,
    autenticado: true,
    usuario: sesion.usuario,
  })
}
