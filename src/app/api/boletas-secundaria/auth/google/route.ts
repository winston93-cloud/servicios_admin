import { NextResponse } from 'next/server'
import {
  autenticarBoletasGoogle,
  encodeBoletasSession,
  opcionesCookieBoletas,
} from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { boletasEnvConfigured } from '@/lib/boletasInsforge'
import { RacGoogleAuthError, verificarCredencialGoogle } from '@/lib/racGoogleIdToken'

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
    const body = (await req.json()) as { idToken?: string; accessToken?: string }
    const { email } = await verificarCredencialGoogle({
      idToken: body.idToken,
      accessToken: body.accessToken,
    })
    const session = autenticarBoletasGoogle(email)
    if (!session) {
      return NextResponse.json(
        {
          error:
            'Este correo no tiene acceso Google a boletas. Solo dg@winston93.edu.mx y sistemas.desarrollo@winston93.edu.mx (como dirección en todos los niveles).',
        },
        { status: 403 }
      )
    }
    const token = encodeBoletasSession(session)
    const res = jsonOk({
      ok: true,
      role: session.role,
      id: session.id,
      nombre: session.nombre,
      usuario: session.usuario,
    })
    res.cookies.set(opcionesCookieBoletas(token))
    return res
  } catch (e) {
    if (e instanceof RacGoogleAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return jsonError(e)
  }
}
