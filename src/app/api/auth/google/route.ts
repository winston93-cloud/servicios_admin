/**
 * 2026-09-21 - Google Auth para login del portal Servicios Administrativos.
 * Solo personal (tabla usuario / usuario_email @winston93.edu.mx).
 * La sesión se devuelve en JSON; el cliente la guarda en sessionStorage (como login por clave).
 */
import { NextResponse } from 'next/server'
import {
  candidatosPortalDesdeUsuarios,
  listarUsuariosPortalPorEmail,
  sessionDesdeUsuarioPortal,
} from '@/lib/portalAuthGoogle'
import { RacGoogleAuthError, verificarCredencialGoogle } from '@/lib/racGoogleIdToken'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      idToken?: string
      accessToken?: string
      account?: { tipo?: string; id?: number }
    }

    const { email } = await verificarCredencialGoogle({
      idToken: body.idToken,
      accessToken: body.accessToken,
    })

    const usuarios = await listarUsuariosPortalPorEmail(email)

    if (!usuarios.length) {
      return NextResponse.json(
        {
          error:
            'Este correo institucional no está ligado a una cuenta administrativa. Pide a Sistemas que registre el email en el catálogo de usuarios.',
        },
        { status: 404 }
      )
    }

    const accountId = Number(body.account?.id)
    let elegido = usuarios[0]

    if (usuarios.length > 1) {
      if (Number.isFinite(accountId) && accountId > 0) {
        const match = usuarios.find((u) => u.usuario_id === accountId)
        if (!match) {
          return NextResponse.json(
            { error: 'El perfil elegido no coincide con este correo.' },
            { status: 400 }
          )
        }
        elegido = match
      } else {
        return NextResponse.json(
          {
            ok: false,
            code: 'ambiguous',
            email,
            candidates: candidatosPortalDesdeUsuarios(usuarios),
          },
          { status: 409 }
        )
      }
    }

    const session = sessionDesdeUsuarioPortal(elegido)
    return NextResponse.json({ ok: true, session })
  } catch (e) {
    if (e instanceof RacGoogleAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    const msg = e instanceof Error ? e.message : 'Error al iniciar sesión con Google'
    console.error('POST /api/auth/google:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
