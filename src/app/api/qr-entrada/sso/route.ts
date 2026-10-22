import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import {
  crearTokenSsoQrEntrada,
  puedeSsoQrEntrada,
  urlSsoQrEntrada,
} from '@/lib/qrEntradaSso'
import { urlLoginQrEntrada } from '@/lib/dashboardModulosConfig'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response

  const uid = Number(auth.session.usuario_id) || 0
  if (!puedeSsoQrEntrada(uid)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Tu cuenta no tiene acceso al panel de registro QR.',
        fallback: urlLoginQrEntrada(),
      },
      { status: 403 },
    )
  }

  try {
    const token = crearTokenSsoQrEntrada({
      usuarioId: uid,
      username: auth.session.usuario_username || String(uid),
      displayName: auth.session.displayName,
    })
    return NextResponse.json({
      ok: true,
      url: urlSsoQrEntrada(token),
    })
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'No se pudo firmar el acceso.'
    return NextResponse.json(
      { ok: false, error: mensaje, fallback: urlLoginQrEntrada() },
      { status: 500 },
    )
  }
}
