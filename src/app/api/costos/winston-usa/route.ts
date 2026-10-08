import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import {
  guardarConfigUsaCiclo,
  montoMxnDesdeUsd,
  obtenerConfigUsaCiclo,
  obtenerTipoCambioUsdHoy,
  type PagoUsa,
  type UsaPagoConfig,
} from '@/lib/winstonUsaProgramPagos'

export const runtime = 'nodejs'

async function respuesta(ciclo: number, config: UsaPagoConfig[]) {
  const db = createDbAdmin()
  const tipoCambio = config.some((c) => c.monto_usd > 0) ? await obtenerTipoCambioUsdHoy(db) : null
  return NextResponse.json({
    ok: true,
    ciclo,
    pagos: config.map((c) => ({
      ...c,
      monto_mxn_hoy: tipoCambio && c.monto_usd > 0 ? montoMxnDesdeUsd(c.monto_usd, tipoCambio.usd_mxn) : null,
    })),
    tipoCambio,
  })
}

export async function GET(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  try {
    const ciclo = Number(new URL(request.url).searchParams.get('ciclo'))
    if (!Number.isFinite(ciclo) || ciclo <= 0) {
      return NextResponse.json({ error: 'ciclo requerido' }, { status: 400 })
    }
    return respuesta(ciclo, await obtenerConfigUsaCiclo(createDbAdmin(), ciclo))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al leer Winston USA Program'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json()) as {
      ciclo?: number
      pagos?: { pago?: number; monto_usd?: number; fecha_apertura?: string }[]
    }
    const ciclo = Number(body.ciclo)
    if (!Number.isFinite(ciclo) || ciclo <= 0) {
      return NextResponse.json({ error: 'ciclo requerido' }, { status: 400 })
    }
    const pagos: UsaPagoConfig[] = []
    for (const p of body.pagos ?? []) {
      const pago = Number(p.pago)
      const monto = Number(p.monto_usd)
      const fecha = String(p.fecha_apertura ?? '')
      if (![1, 2, 3].includes(pago)) {
        return NextResponse.json({ error: 'pago debe ser 1, 2 o 3' }, { status: 400 })
      }
      if (!Number.isFinite(monto) || monto < 0) {
        return NextResponse.json({ error: `Monto USD inválido en el pago ${pago}` }, { status: 400 })
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return NextResponse.json({ error: `Fecha de apertura inválida en el pago ${pago}` }, { status: 400 })
      }
      pagos.push({ pago: pago as PagoUsa, monto_usd: monto, fecha_apertura: fecha })
    }
    if (pagos.length !== 3 || new Set(pagos.map((p) => p.pago)).size !== 3) {
      return NextResponse.json({ error: 'Se requieren los 3 pagos' }, { status: 400 })
    }
    const config = await guardarConfigUsaCiclo(createDbAdmin(), ciclo, pagos)
    return respuesta(ciclo, config)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al guardar Winston USA Program'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
