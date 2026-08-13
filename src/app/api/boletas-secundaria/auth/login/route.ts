import { NextResponse } from 'next/server'
import {
  autenticarBoletas,
  encodeBoletasSession,
  opcionesCookieBoletas,
} from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { boletasEnvConfigured } from '@/lib/boletasInsforge'

export async function POST(req: Request) {
  try {
    if (!boletasEnvConfigured()) {
      return NextResponse.json(
        {
          error:
            'Proyecto InsForge boletas no configurado (BOLETAS_INSFORGE_URL / BOLETAS_INSFORGE_API_KEY).',
        },
        { status: 503 }
      )
    }
    const body = (await req.json()) as { usuario?: string; password?: string }
    const session = await autenticarBoletas(String(body.usuario ?? ''), String(body.password ?? ''))
    if (!session) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 })
    }
    const token = encodeBoletasSession(session)
    const res = jsonOk({
      ok: true,
      role: session.role,
      id: session.id,
      nombre: session.nombre,
      usuario: session.usuario,
    })
    const opt = opcionesCookieBoletas(token)
    res.cookies.set(opt)
    return res
  } catch (e) {
    return jsonError(e)
  }
}
