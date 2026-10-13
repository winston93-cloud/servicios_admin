import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/boletasApi'
import { autenticarCaptura, capturaConfigDeSlug, cookieSesionCaptura } from '@/lib/boletasCapturaAuth'

type Params = { params: Promise<{ slug: string }> }

export async function POST(req: Request, { params }: Params) {
  try {
    const cfg = capturaConfigDeSlug((await params).slug)
    const body = (await req.json().catch(() => ({}))) as { usuario?: unknown; password?: unknown }
    const sesion = await autenticarCaptura(cfg, String(body.usuario ?? ''), String(body.password ?? ''))
    if (!sesion) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 })
    }
    const res = NextResponse.json({ ok: true, nombre: sesion.nombre })
    res.cookies.set(cookieSesionCaptura(cfg, sesion))
    return res
  } catch (e) {
    return jsonError(e)
  }
}
