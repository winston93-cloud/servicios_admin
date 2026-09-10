import { NextResponse } from 'next/server'
import {
  candidatosRacNivelPorEmail,
  cookieRespuestaNivel,
  resolverCandidatoUnico,
  sesionNivelDesdeCandidato,
  type RacGoogleAccountRef,
} from '@/lib/racAuthGoogle'
import { RacGoogleAuthError, verificarIdTokenGoogle } from '@/lib/racGoogleIdToken'
import {
  cfgDesdeRequestSlug,
  jsonRacNivelError,
} from '@/lib/rac/racAuthNivel'

type Params = { params: Promise<{ slug: string }> }

export async function POST(req: Request, { params }: Params) {
  try {
    const { slug } = await params
    const cfg = cfgDesdeRequestSlug(slug)
    const body = (await req.json()) as {
      idToken?: string
      account?: RacGoogleAccountRef
    }
    const { email } = await verificarIdTokenGoogle(String(body.idToken ?? ''))
    const candidates = await candidatosRacNivelPorEmail(cfg, email)
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
          error: `Este correo institucional no está ligado a una cuenta de ${cfg.titulo}. Pide a Sistemas que registre el email en el catálogo.`,
        },
        { status: 404 }
      )
    }

    const session = sesionNivelDesdeCandidato(cfg, resolved.candidate)
    const res = NextResponse.json({
      ok: true,
      role: session.role,
      perfil: session.perfil,
      id: session.id,
      nombre: session.nombre,
      usuario: session.usuario,
    })
    res.cookies.set(cookieRespuestaNivel(cfg, session))
    return res
  } catch (e) {
    if (e instanceof RacGoogleAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    const { error, status } = jsonRacNivelError(e)
    return NextResponse.json({ error }, { status })
  }
}
