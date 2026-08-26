import { NextResponse } from 'next/server'
import {
  autenticarRacNivel,
  cfgDesdeRequestSlug,
  encodeRacNivelSession,
  jsonRacNivelError,
  opcionesCookieRacNivel,
} from '@/lib/rac/racAuthNivel'

type Params = { params: Promise<{ slug: string }> }

export async function POST(req: Request, { params }: Params) {
  try {
    const { slug } = await params
    const cfg = cfgDesdeRequestSlug(slug)
    const body = (await req.json()) as { usuario?: string; password?: string }
    const session = await autenticarRacNivel(cfg, String(body.usuario ?? ''), String(body.password ?? ''))
    if (!session) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 })
    }
    const token = encodeRacNivelSession(cfg, session)
    const res = NextResponse.json({
      ok: true,
      role: session.role,
      perfil: session.perfil,
      id: session.id,
      nombre: session.nombre,
      usuario: session.usuario,
    })
    res.cookies.set(opcionesCookieRacNivel(cfg, token))
    return res
  } catch (e) {
    const { error, status } = jsonRacNivelError(e)
    return NextResponse.json({ error }, { status })
  }
}
