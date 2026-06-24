import { NextResponse } from 'next/server'
import {
  pacConfigurado,
  timbrarPorMes,
  timbrarReferencia,
} from '@/lib/cfdi/cfdiTimbradoService'
import { createDbAdmin } from '@/lib/insforgeAdmin'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET() {
  return NextResponse.json({
    ok: true,
    pacConfigurado: pacConfigurado(),
    operaciones: ['mes', 'individual'],
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const modo = String(body.modo ?? '').trim()
    const creadoPor = body.creadoPor ? String(body.creadoPor) : undefined
    const db = createDbAdmin()

    if (!pacConfigurado()) {
      return NextResponse.json(
        {
          error:
            'Configura FACTUROPORTI_BEARER_*, FACTUROPORTI_*_CSD, FACTUROPORTI_*_KEY y FACTUROPORTI_*_CSD_PASSWORD en Vercel.',
        },
        { status: 503 }
      )
    }

    if (modo === 'individual') {
      const referencia = String(body.referencia ?? '').trim()
      if (!referencia) {
        return NextResponse.json({ error: 'referencia es obligatoria' }, { status: 400 })
      }
      const metodo = body.metodo ? String(body.metodo) : undefined
      const resultado = await timbrarReferencia(db, referencia, metodo, creadoPor)
      return NextResponse.json({ ok: resultado.ok, resultado })
    }

    if (modo === 'mes') {
      const mes = Number(body.mes)
      const metodo = String(body.metodo ?? '').trim()
      if (!mes || mes < 1 || mes > 12) {
        return NextResponse.json({ error: 'mes debe ser 1–12' }, { status: 400 })
      }
      if (!metodo) {
        return NextResponse.json({ error: 'metodo es obligatorio (Efectivo o Transferencia)' }, { status: 400 })
      }
      const resultado = await timbrarPorMes(db, mes, metodo, creadoPor)
      return NextResponse.json({ ok: resultado.fallidos === 0, resultado })
    }

    return NextResponse.json({ error: 'modo debe ser mes o individual' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al timbrar'
    console.error('facturacion/timbrar POST:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
