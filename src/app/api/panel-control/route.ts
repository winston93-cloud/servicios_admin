import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { leerPanelControl } from '@/lib/panelControl/panelControl'
import { PANEL_CONTROL_USUARIOS } from '@/lib/panelControl/tipos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Lecturas de los 8 procesos para el panel de control (solo sistemas). */
export async function GET(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  if (!PANEL_CONTROL_USUARIOS.includes(Number(auth.session.usuario_id) || 0)) {
    return NextResponse.json({ error: 'No tienes permiso para el Main Control Room.' }, { status: 403 })
  }
  try {
    return NextResponse.json(await leerPanelControl(), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('GET /api/panel-control:', e)
    return NextResponse.json({ error: 'No se pudo leer el Main Control Room.' }, { status: 500 })
  }
}
