import { NextResponse } from 'next/server'
import { AccesosError, requireBovedaAbierta } from '@/lib/accesos/accesosAuth'
import {
  eliminarAcceso,
  guardarAcceso,
  listarAccesos,
  listarBitacora,
  revelarPassword,
  type AccesoInput,
} from '@/lib/accesos/accesosService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SIN_CACHE = { 'Cache-Control': 'no-store' }

function responderError(e: unknown, contexto: string) {
  if (e instanceof AccesosError) return NextResponse.json({ error: e.message }, { status: e.status, headers: SIN_CACHE })
  console.error(contexto, e)
  return NextResponse.json({ error: 'Error inesperado' }, { status: 500, headers: SIN_CACHE })
}

export async function GET(request: Request) {
  const auth = requireBovedaAbierta(request)
  if (!auth.ok) return auth.response
  try {
    const bitacora = new URL(request.url).searchParams.get('bitacora') === '1'
    return NextResponse.json(bitacora ? { bitacora: await listarBitacora() } : { accesos: await listarAccesos() }, {
      headers: SIN_CACHE,
    })
  } catch (e) {
    return responderError(e, 'GET /api/accesos:')
  }
}

/** Body: `{ accion: 'guardar', ...campos }` | `{ accion: 'ver' | 'copiar', id }`. */
export async function POST(request: Request) {
  const auth = requireBovedaAbierta(request)
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json().catch(() => ({}))) as AccesoInput & { accion?: unknown }
    if (body.accion === 'ver' || body.accion === 'copiar') {
      const id = Number(body.id) || 0
      if (!id) throw new AccesosError('Falta el acceso.')
      const password = await revelarPassword(id, body.accion, auth)
      return NextResponse.json({ password }, { headers: SIN_CACHE })
    }
    if (body.accion !== 'guardar') throw new AccesosError('Acción no válida.')
    const acceso = await guardarAcceso(body, auth)
    return NextResponse.json({ acceso }, { headers: SIN_CACHE })
  } catch (e) {
    return responderError(e, 'POST /api/accesos:')
  }
}

export async function DELETE(request: Request) {
  const auth = requireBovedaAbierta(request)
  if (!auth.ok) return auth.response
  try {
    const id = Number(new URL(request.url).searchParams.get('id')) || 0
    if (!id) throw new AccesosError('Falta el acceso.')
    await eliminarAcceso(id, auth)
    return NextResponse.json({ ok: true }, { headers: SIN_CACHE })
  } catch (e) {
    return responderError(e, 'DELETE /api/accesos:')
  }
}
