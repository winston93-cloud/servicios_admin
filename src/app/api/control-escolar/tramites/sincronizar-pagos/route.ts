import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { sincronizarTramitesPorPagoIds } from '@/lib/controlEscolarTramitesSync'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { pagoIds?: number[] }
    const pagoIds = Array.isArray(body.pagoIds) ? body.pagoIds.map(Number) : []
    const db = createDbAdmin()
    const result = await sincronizarTramitesPorPagoIds(db, pagoIds)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error en el sistema'
    console.error('API tramites/sincronizar-pagos:', e)
    return NextResponse.json({ ok: false, mensaje: message }, { status: 500 })
  }
}
