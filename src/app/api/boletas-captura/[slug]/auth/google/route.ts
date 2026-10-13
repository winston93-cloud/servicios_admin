import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/boletasApi'
import { candidatosCapturaPorEmail, capturaConfigDeSlug, cookieSesionCaptura } from '@/lib/boletasCapturaAuth'
import { resolverCandidatoUnico, type RacGoogleAccountRef } from '@/lib/racAuthGoogle'
import { RacGoogleAuthError, verificarCredencialGoogle } from '@/lib/racGoogleIdToken'

type Params = { params: Promise<{ slug: string }> }

export async function POST(req: Request, { params }: Params) {
  try {
    const cfg = capturaConfigDeSlug((await params).slug)
    const body = (await req.json().catch(() => ({}))) as {
      idToken?: string
      accessToken?: string
      account?: RacGoogleAccountRef
    }
    const { email } = await verificarCredencialGoogle({ idToken: body.idToken, accessToken: body.accessToken })
    const candidatos = await candidatosCapturaPorEmail(cfg, email)
    const resuelto = resolverCandidatoUnico(candidatos, body.account ?? null)
    if (!resuelto.ok) {
      if (resuelto.code === 'ambiguous') {
        return NextResponse.json(
          { ok: false, code: 'ambiguous', email, candidates: resuelto.candidates },
          { status: 409 }
        )
      }
      return NextResponse.json(
        {
          error: `El correo ${email} no está registrado como docente de ${cfg.titulo}. Pide a tu directora que lo agregue en el catálogo.`,
        },
        { status: 404 }
      )
    }
    const c = resuelto.candidate
    const res = NextResponse.json({ ok: true, nombre: c.nombre })
    res.cookies.set(cookieSesionCaptura(cfg, { maestroId: c.id, nombre: c.nombre, usuario: c.usuario || email }))
    return res
  } catch (e) {
    if (e instanceof RacGoogleAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return jsonError(e)
  }
}
