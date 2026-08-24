import { NextResponse } from 'next/server'
import { registrarTramiteDesdePagoInterno } from '@/lib/controlEscolarTramitesService'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      pagoId?: number
      alumnoId?: number
      conceptoId?: number
      pagoFolio?: number
      pagoCiclo?: number
    }
    const result = await registrarTramiteDesdePagoInterno({
      pagoId: Number(body.pagoId),
      alumnoId: Number(body.alumnoId),
      conceptoId: Number(body.conceptoId),
      pagoFolio: Number(body.pagoFolio),
      pagoCiclo: Number(body.pagoCiclo),
    })
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error en el sistema'
    console.error('API tramites/desde-pago:', e)
    return NextResponse.json({ ok: false, mensaje: message }, { status: 500 })
  }
}
