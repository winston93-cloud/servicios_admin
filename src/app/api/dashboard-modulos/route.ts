import { NextResponse } from 'next/server'
import { obtenerModulosDashboardUsuario } from '@/lib/usuarioCatalogoService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const usuarioId = Number(new URL(request.url).searchParams.get('usuario_id'))
  if (!Number.isFinite(usuarioId) || usuarioId <= 0) {
    return NextResponse.json({ error: 'usuario_id inválido' }, { status: 400 })
  }
  try {
    const modulos = await obtenerModulosDashboardUsuario(usuarioId)
    return NextResponse.json({ modulos })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al cargar accesos'
    console.error('GET /api/dashboard-modulos:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
