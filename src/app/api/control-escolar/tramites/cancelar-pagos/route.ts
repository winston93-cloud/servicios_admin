import { NextResponse } from 'next/server'
import { cancelarTramitesPorPagoIds } from '@/lib/controlEscolarTramitesService'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { pagoIds?: number[] }
    const pagoIds = Array.isArray(body.pagoIds) ? body.pagoIds.map(Number) : []
    await cancelarTramitesPorPagoIds(pagoIds)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error en el sistema'
    console.error('API tramites/cancelar-pagos:', e)
    return NextResponse.json({ ok: false, mensaje: message }, { status: 500 })
  }
}
