import { NextResponse } from 'next/server'
import {
  autenticarRac,
  encodeRacSession,
  jsonRacError,
  opcionesCookieRac,
} from '@/lib/racAuth'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { usuario?: string; password?: string }
    const session = await autenticarRac(String(body.usuario ?? ''), String(body.password ?? ''))
    if (!session) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 })
    }
    const token = encodeRacSession(session)
    const res = NextResponse.json({
      ok: true,
      role: session.role,
      perfil: session.perfil,
      id: session.id,
      nombre: session.nombre,
      usuario: session.usuario,
    })
    const opt = opcionesCookieRac(token)
    res.cookies.set(opt)
    return res
  } catch (e) {
    const { error, status } = jsonRacError(e)
    return NextResponse.json({ error }, { status })
  }
}
