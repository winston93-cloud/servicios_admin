import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  obtenerSiguienteFolioPago,
  type PlantelPagosInternos,
  type TipoSerieFolioPagoInterno,
} from '@/lib/pagoInternoService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLANTELES = new Set<PlantelPagosInternos>(['winston', 'educativo'])
const TIPOS = new Set<TipoSerieFolioPagoInterno>(['general', 'cuota_padres'])

/**
 * GET ?plantel=winston&tipo=general
 * Siguiente folio con la misma lógica que reparar-folios-winston (admin DB).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const plantelRaw = (searchParams.get('plantel') ?? 'winston').toLowerCase()
    const tipoRaw = (searchParams.get('tipo') ?? 'general').toLowerCase()

    if (!PLANTELES.has(plantelRaw as PlantelPagosInternos)) {
      return NextResponse.json({ ok: false, mensaje: 'plantel inválido' }, { status: 400 })
    }
    if (!TIPOS.has(tipoRaw as TipoSerieFolioPagoInterno)) {
      return NextResponse.json({ ok: false, mensaje: 'tipo inválido' }, { status: 400 })
    }

    const plantel = plantelRaw as PlantelPagosInternos
    const tipo = tipoRaw as TipoSerieFolioPagoInterno
    const db = createDbAdmin()
    const folio = await obtenerSiguienteFolioPago(plantel, tipo, db)

    return NextResponse.json({ ok: true, folio, plantel, tipo })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al obtener siguiente folio'
    console.error('GET /api/servicios/siguiente-folio-pago:', e)
    return NextResponse.json({ ok: false, mensaje: msg }, { status: 500 })
  }
}
