import { NextResponse } from 'next/server'
import { sesionPortalDeRequest } from '@/lib/portalSesionFirmada'
import {
  crearEnlace,
  eliminarEnlace,
  listarEnlaces,
  responderError,
  verificarPin,
} from '@/lib/enlacesX/enlacesXService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Lectura pública; altas y bajas solo con el PIN de administración.

function quien(request: Request): string {
  const s = sesionPortalDeRequest(request)
  return (s?.role === 'usuario' && s.displayName) || 'Administrador (PIN)'
}

export async function GET() {
  try {
    return NextResponse.json({ enlaces: await listarEnlaces() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return responderError(e, 'GET /api/enlaces-x:')
  }
}

export async function POST(request: Request) {
  try {
    await verificarPin(request)
    const body = (await request.json()) as Record<string, unknown>
    return NextResponse.json({ ok: true, enlace: await crearEnlace(body, quien(request)) })
  } catch (e) {
    return responderError(e, 'POST /api/enlaces-x:')
  }
}

export async function DELETE(request: Request) {
  try {
    await verificarPin(request)
    await eliminarEnlace(new URL(request.url).searchParams.get('id'), quien(request))
    return NextResponse.json({ ok: true })
  } catch (e) {
    return responderError(e, 'DELETE /api/enlaces-x:')
  }
}
