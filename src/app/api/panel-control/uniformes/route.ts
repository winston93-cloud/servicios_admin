import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { leerPanelUniformes } from '@/lib/panelControl/uniformes'
import { PANEL_CONTROL_USUARIOS } from '@/lib/panelControl/tipos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Lecturas del banco de Uniformes del panel de control (solo sistemas). */
export async function GET(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  if (!PANEL_CONTROL_USUARIOS.includes(Number(auth.session.usuario_id) || 0)) {
    return NextResponse.json({ error: 'No tienes permiso para el Main Control Room.' }, { status: 403 })
  }
  try {
    return NextResponse.json(await leerPanelUniformes(), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('GET /api/panel-control/uniformes:', e)
    return NextResponse.json({ error: 'No se pudo leer el panel de Uniformes.' }, { status: 500 })
  }
}
