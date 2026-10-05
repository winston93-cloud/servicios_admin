/**
 * 2026-10-05 — Exportación de talleres para el reloj checador (Bearer TALLERES_SYNC_SECRET).
 * GET ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD → catálogo vigente + asistencia del rango.
 */
import { NextResponse } from 'next/server'
import { responderErrorTalleres } from '@/lib/talleres/talleresApi'
import { exportarParaReloj, secretoSyncValido } from '@/lib/talleres/talleresRelojSync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!secretoSyncValido(request)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }
  try {
    const url = new URL(request.url)
    const datos = await exportarParaReloj(url.searchParams.get('desde'), url.searchParams.get('hasta'))
    return NextResponse.json(datos, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })
  } catch (e) {
    return responderErrorTalleres(e, 'GET /api/talleres/export:')
  }
}
