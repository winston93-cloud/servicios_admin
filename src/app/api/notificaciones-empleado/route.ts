import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import {
  enviarNotificacionMasivaEmpleados,
  listarNotificacionesEmpleado,
  marcarNotificacionesEmpleadoLeidas,
} from '@/lib/notificacionEmpleadoService'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response

  const usuarioId = Number(auth.session.usuario_id)
  if (!(usuarioId > 0)) {
    return NextResponse.json({ ok: false, message: 'Sesión sin usuario_id' }, { status: 400 })
  }

  try {
    const data = await listarNotificacionesEmpleado(usuarioId, 40)
    return NextResponse.json({ ok: true, ...data })
  } catch (e) {
    console.error('API notificaciones-empleado GET:', e)
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json().catch(() => ({}))) as {
      usuarioIds?: number[]
      asunto?: string
      mensaje?: string
    }
    const result = await enviarNotificacionMasivaEmpleados({
      usuarioIds: body.usuarioIds ?? [],
      asunto: body.asunto ?? '',
      mensaje: body.mensaje ?? '',
      enviadoPor:
        auth.session.displayName?.trim() ||
        auth.session.usuario_username?.trim() ||
        'empleado',
    })
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 })
    }
    return NextResponse.json({
      ok: true,
      enviadas: result.enviadas,
      correosOk: result.correosOk,
      sinCorreo: result.sinCorreo,
      errores: result.errores,
    })
  } catch (e) {
    console.error('API notificaciones-empleado POST:', e)
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response

  const usuarioId = Number(auth.session.usuario_id)
  if (!(usuarioId > 0)) {
    return NextResponse.json({ ok: false, message: 'Sesión sin usuario_id' }, { status: 400 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      ids?: number[]
    }
    const result = await marcarNotificacionesEmpleadoLeidas({
      usuarioId,
      ids: body.ids,
      realizadoPor:
        auth.session.displayName?.trim() ||
        auth.session.usuario_username?.trim() ||
        'empleado',
    })
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true, updated: result.updated })
  } catch (e) {
    console.error('API notificaciones-empleado PATCH:', e)
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    )
  }
}
