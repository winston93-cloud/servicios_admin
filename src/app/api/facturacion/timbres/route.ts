import { consultarSaldosTimbres } from '@/lib/cfdi/cfdiTimbresService'
import { pacConfigurado } from '@/lib/cfdi/cfdiTimbradoService'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    if (!pacConfigurado()) {
      return NextResponse.json(
        { error: 'Configura credenciales FACTUROPORTI en Vercel.' },
        { status: 503 }
      )
    }

    const saldos = await consultarSaldosTimbres()
    return NextResponse.json({ ok: true, saldos })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al consultar timbres'
    console.error('facturacion/timbres GET:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
