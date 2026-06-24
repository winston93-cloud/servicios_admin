import { emitirNotaCredito } from '@/lib/cfdi/cfdiNotaCreditoService'
import { pacConfigurado } from '@/lib/cfdi/cfdiTimbradoService'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: Request) {
  try {
    if (!pacConfigurado()) {
      return NextResponse.json(
        { error: 'Configura credenciales FACTUROPORTI en Vercel.' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const referencia = String(body.referencia ?? '').trim()
    const uuid = String(body.uuid ?? '').trim()
    const tipoRelacion = String(body.tipoRelacion ?? '01').trim()

    if (!referencia || !uuid) {
      return NextResponse.json({ error: 'referencia y uuid son obligatorios' }, { status: 400 })
    }

    const db = createDbAdmin()
    const resultado = await emitirNotaCredito(
      db,
      referencia,
      uuid,
      tipoRelacion,
      body.creadoPor ? String(body.creadoPor) : undefined
    )

    return NextResponse.json({ ok: resultado.ok, resultado })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al emitir nota de crédito'
    console.error('facturacion/nota-credito POST:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
