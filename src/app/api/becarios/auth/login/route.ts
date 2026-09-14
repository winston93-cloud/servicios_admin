import { NextResponse } from 'next/server'
import { BECARIOS } from '@/lib/becariosCatalog'
import {
  autenticarBecario,
  encodeBecariosSession,
  jsonBecariosError,
  opcionesCookieBecarios,
} from '@/lib/becariosAuth'

export async function GET() {
  return NextResponse.json({
    ok: true,
    becarios: BECARIOS.map((b) => ({
      username: b.username,
      nombre: b.nombre,
      iniciales: b.iniciales,
      accent: b.accent,
    })),
  })
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { username?: string; password?: string }
    const session = autenticarBecario(String(body.username ?? ''), String(body.password ?? ''))
    if (!session) {
      return NextResponse.json({ error: 'Nombre o contraseña incorrectos' }, { status: 401 })
    }
    const token = encodeBecariosSession(session)
    const res = NextResponse.json({
      ok: true,
      me: { username: session.username, nombre: session.nombre },
    })
    res.cookies.set(opcionesCookieBecarios(token))
    return res
  } catch (e) {
    const { error, status } = jsonBecariosError(e)
    return NextResponse.json({ error }, { status })
  }
}
