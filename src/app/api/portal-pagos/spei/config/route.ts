import { NextResponse } from 'next/server'
import {
  configOpenpayPublica,
  obtenerConfigOpenpay,
} from '@/lib/portalPagosSpei'

export const runtime = 'nodejs'

/** Llaves públicas OpenPay para device_session_id en el cliente (sin secret). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const nivel = Number(searchParams.get('nivel'))
    if (!nivel) {
      return NextResponse.json({ error: 'nivel es obligatorio' }, { status: 400 })
    }

    const config = obtenerConfigOpenpay(nivel)
    return NextResponse.json({ ok: true, config: configOpenpayPublica(config) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Configuración OpenPay no disponible'
    return NextResponse.json({ error: msg }, { status: 503 })
  }
}
