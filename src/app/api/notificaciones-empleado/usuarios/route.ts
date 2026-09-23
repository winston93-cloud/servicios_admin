import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { buscarUsuariosParaNotificar } from '@/lib/notificacionEmpleadoService'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''
  const limit = Number(url.searchParams.get('limit') || 12)

  try {
    const rows = await buscarUsuariosParaNotificar(q, limit)
    return NextResponse.json({ ok: true, rows })
  } catch (e) {
    console.error('API notificaciones-empleado/usuarios:', e)
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    )
  }
}
