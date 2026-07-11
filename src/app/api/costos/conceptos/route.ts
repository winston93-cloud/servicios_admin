import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  actualizarConceptoBoucher,
  crearConceptoBoucher,
  eliminarConceptoBoucher,
  listarConceptosBoucherCatalogo,
  type ConceptoBoucherInput,
} from '@/lib/conceptoBoucherCatalogService'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const db = createDbAdmin()
    const conceptos = await listarConceptosBoucherCatalogo(db)
    return NextResponse.json({ ok: true, conceptos })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al listar conceptos'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ConceptoBoucherInput>
    const input: ConceptoBoucherInput = {
      concepto_no: String(body.concepto_no ?? ''),
      concepto_clase: String(body.concepto_clase ?? ''),
      alumno_nivel: Number(body.alumno_nivel ?? 0),
      concepto_tipo: Number(body.concepto_tipo ?? 0),
      concepto_descuento: Number(body.concepto_descuento ?? 0),
    }
    const db = createDbAdmin()
    const concepto = await crearConceptoBoucher(db, input)
    return NextResponse.json({ ok: true, concepto })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al crear concepto'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Partial<ConceptoBoucherInput> & {
      concepto_id?: number
    }
    const conceptoId = Number(body.concepto_id)
    if (!conceptoId) {
      return NextResponse.json({ error: 'concepto_id requerido' }, { status: 400 })
    }
    const input: ConceptoBoucherInput = {
      concepto_no: String(body.concepto_no ?? ''),
      concepto_clase: String(body.concepto_clase ?? ''),
      alumno_nivel: Number(body.alumno_nivel ?? 0),
      concepto_tipo: Number(body.concepto_tipo ?? 0),
      concepto_descuento: Number(body.concepto_descuento ?? 0),
    }
    const db = createDbAdmin()
    const concepto = await actualizarConceptoBoucher(db, conceptoId, input)
    return NextResponse.json({ ok: true, concepto })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al actualizar concepto'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get('id'))
    if (!id) {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    }
    const db = createDbAdmin()
    await eliminarConceptoBoucher(db, id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al eliminar concepto'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
