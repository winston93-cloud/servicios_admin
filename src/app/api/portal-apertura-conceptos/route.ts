import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  guardarAperturaConceptosPortal,
  obtenerAperturaConceptosPortal,
} from '@/lib/portalAperturaConceptosService'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const fila = await obtenerAperturaConceptosPortal(createDbAdmin())
    return NextResponse.json({ ok: true, fila })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al leer apertura de conceptos'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      cambridge_abierto?: boolean
      doble_titulacion_abierto?: boolean
      actualizado_por?: string | null
    }

    const fila = await guardarAperturaConceptosPortal(createDbAdmin(), {
      cambridge_abierto: Boolean(body.cambridge_abierto),
      doble_titulacion_abierto: Boolean(body.doble_titulacion_abierto),
      actualizado_por: body.actualizado_por ?? null,
    })

    return NextResponse.json({ ok: true, fila })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al guardar apertura de conceptos'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
