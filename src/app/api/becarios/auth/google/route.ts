import { NextResponse } from 'next/server'
import {
  autenticarRevisorGoogle,
  encodeBecariosSession,
  jsonBecariosError,
  mePublico,
  opcionesCookieBecarios,
} from '@/lib/becariosAuth'
import { RacGoogleAuthError, verificarCredencialGoogle } from '@/lib/racGoogleIdToken'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { idToken?: string; accessToken?: string }
    const { email } = await verificarCredencialGoogle({
      idToken: body.idToken,
      accessToken: body.accessToken,
    })
    const session = autenticarRevisorGoogle(email)
    if (!session) {
      return NextResponse.json(
        {
          error:
            'Este correo no tiene acceso de revisión a la bitácora. Solo sistemas.desarrollo@winston93.edu.mx y dg@winston93.edu.mx.',
        },
        { status: 403 }
      )
    }
    const token = encodeBecariosSession(session)
    const res = NextResponse.json({ ok: true, me: mePublico(session) })
    res.cookies.set(opcionesCookieBecarios(token))
    return res
  } catch (e) {
    if (e instanceof RacGoogleAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    const { error, status } = jsonBecariosError(e)
    return NextResponse.json({ error }, { status })
  }
}
