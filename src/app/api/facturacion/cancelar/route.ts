import { cancelarCfdi } from '@/lib/cfdi/cfdiCancelacionService'
import { pacConfigurado } from '@/lib/cfdi/cfdiTimbradoService'
import type { CfdiMotivoCancelacion } from '@/lib/cfdi/cfdiTypes'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    if (!pacConfigurado()) {
      return NextResponse.json(
        { error: 'Configura credenciales FACTUROPORTI en Vercel.' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const db = createDbAdmin()

    const resultado = await cancelarCfdi(db, {
      uuid: String(body.uuid ?? '').trim(),
      folioSustitucion: String(body.folioSustitucion ?? '').trim(),
      rfcEmisor: String(body.rfcEmisor ?? '').trim(),
      rfcReceptor: String(body.rfcReceptor ?? '').trim(),
      total: Number(body.total),
      motivo: String(body.motivo ?? '02') as CfdiMotivoCancelacion,
      emisor: body.emisor === 'educativo' ? 'educativo' : body.emisor === 'churchill' ? 'churchill' : undefined,
      creadoPor: body.creadoPor ? String(body.creadoPor) : undefined,
    })

    return NextResponse.json({ ok: resultado.ok, resultado })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cancelar'
    console.error('facturacion/cancelar POST:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
