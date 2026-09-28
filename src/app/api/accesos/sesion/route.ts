import { NextResponse } from 'next/server'
import {
  AccesosError,
  abrirBoveda,
  estadoBoveda,
  ponerCookieBoveda,
  quitarCookieBoveda,
  requireUsuarioAccesos,
} from '@/lib/accesos/accesosAuth'
import { registrarBitacora } from '@/lib/accesos/accesosService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const u = requireUsuarioAccesos(request)
  if (!u.ok) return u.response
  try {
    const b = estadoBoveda(request, u.uid)
    return NextResponse.json(b ? { abierta: true, nombre: b.nombre, expira: b.exp } : { abierta: false })
  } catch (e) {
    const status = e instanceof AccesosError ? e.status : 500
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status })
  }
}

export async function POST(request: Request) {
  const u = requireUsuarioAccesos(request)
  if (!u.ok) return u.response
  try {
    const body = (await request.json().catch(() => ({}))) as { password?: unknown }
    const password = typeof body.password === 'string' ? body.password : ''
    if (!password.trim()) throw new AccesosError('Escribe tu contraseña del portal.')
    let boveda
    try {
      boveda = await abrirBoveda(u.uid, u.nombre, password)
    } catch (e) {
      if (e instanceof AccesosError && e.status === 401) await registrarBitacora('intento_fallido', u)
      throw e
    }
    await registrarBitacora('abrir', u)
    const res = NextResponse.json({ abierta: true, nombre: boveda.nombre, expira: boveda.exp })
    ponerCookieBoveda(res, boveda)
    return res
  } catch (e) {
    if (e instanceof AccesosError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('POST /api/accesos/sesion:', e)
    return NextResponse.json({ error: 'No se pudo abrir la bóveda.' }, { status: 500 })
  }
}

export async function DELETE() {
  const res = NextResponse.json({ abierta: false })
  quitarCookieBoveda(res)
  return res
}
