import { NextResponse } from 'next/server'
import {
  candidatosRacSecundariaPorEmail,
  cookieRespuestaSecundaria,
  resolverCandidatoUnico,
  sesionSecundariaDesdeCandidato,
  type RacGoogleAccountRef,
} from '@/lib/racAuthGoogle'
import { RacGoogleAuthError, verificarCredencialGoogle } from '@/lib/racGoogleIdToken'
import { jsonRacError } from '@/lib/racAuth'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      idToken?: string
      accessToken?: string
      account?: RacGoogleAccountRef
    }
    const { email } = await verificarCredencialGoogle({
      idToken: body.idToken,
      accessToken: body.accessToken,
    })
    const candidates = await candidatosRacSecundariaPorEmail(email)
    const resolved = resolverCandidatoUnico(candidates, body.account ?? null)

    if (!resolved.ok) {
      if (resolved.code === 'ambiguous') {
        return NextResponse.json(
          {
            ok: false,
            code: 'ambiguous',
            email,
            candidates: resolved.candidates,
          },
          { status: 409 }
        )
      }
      return NextResponse.json(
        {
          error:
            'Este correo institucional no está ligado a una cuenta de secundaria. Pide a Sistemas que registre el email en el catálogo.',
        },
        { status: 404 }
      )
    }

    const session = sesionSecundariaDesdeCandidato(resolved.candidate)
    const res = NextResponse.json({
      ok: true,
      role: session.role,
      perfil: session.perfil,
      id: session.id,
      nombre: session.nombre,
      usuario: session.usuario,
    })
    res.cookies.set(cookieRespuestaSecundaria(session))
    return res
  } catch (e) {
    if (e instanceof RacGoogleAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    const { error, status } = jsonRacError(e)
    return NextResponse.json({ error }, { status })
  }
}
