import { NextResponse } from 'next/server'
import {
  CSD_DIAS_ALERTA_AMARILLA,
  CSD_DIAS_ALERTA_ROJA,
  listarVencimientosCsd,
} from '@/lib/cfdi/csdVencimientos'

export const runtime = 'nodejs'

/** Vigencia de los CSD FacturoPorTi (Churchill / Educativo) desde env. */
export async function GET() {
  try {
    const filas = listarVencimientosCsd()
    return NextResponse.json({
      ok: true,
      umbrales: {
        rojoDias: CSD_DIAS_ALERTA_ROJA,
        amarilloDias: CSD_DIAS_ALERTA_AMARILLA,
      },
      filas,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al leer CSD'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
