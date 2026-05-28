import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { generarPdfListaSuspendidos } from '@/lib/suspensionesPdf'
import {
  generarListaDeudoresSuspension,
  type GenerarSuspensionesInput,
} from '@/lib/suspensionesService'
import type { TipoReporteSuspension } from '@/lib/suspensionesAdeudos'
import { numeroCicloEscolarAdmin } from '@/lib/cicloEscolarAdmin'

export const runtime = 'nodejs'
export const maxDuration = 120

function parseTipo(v: unknown): TipoReporteSuspension | null {
  const n = Number(v)
  if (n === 1 || n === 2 || n === 3 || n === 4) return n
  return null
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const plantel = Number(body.plantel) === 1 ? 1 : Number(body.plantel) === 2 ? 2 : null
    const tipo = parseTipo(body.tipo)
    const fechaCartas = String(body.fechaCartas ?? '').trim()

    if (!plantel || !tipo) {
      return NextResponse.json(
        { error: 'plantel (1|2) y tipo (1-4) son obligatorios' },
        { status: 400 }
      )
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaCartas)) {
      return NextResponse.json(
        { error: 'fechaCartas debe ser AAAA-MM-DD' },
        { status: 400 }
      )
    }

    let cicloEscolar = Number(body.cicloEscolar)
    if (!cicloEscolar || Number.isNaN(cicloEscolar)) {
      const supabase = createSupabaseAdmin()
      const { data: actual } = await supabase
        .from('ciclos_escolares')
        .select('valor')
        .eq('es_actual', true)
        .maybeSingle()
      cicloEscolar = actual?.valor ?? numeroCicloEscolarAdmin()
    }

    const input: GenerarSuspensionesInput = {
      plantel,
      tipo,
      cicloEscolar,
      fechaCartas,
    }

    const supabase = createSupabaseAdmin()
    const resultado = await generarListaDeudoresSuspension(supabase, input)

    const pdfBuffer = generarPdfListaSuspendidos({
      deudores: resultado.deudores,
      plantel: resultado.plantel,
      tipo: resultado.tipo,
      cicloLargo: resultado.cicloLargo,
      fechaCartas: resultado.fechaCartas,
    })

    return NextResponse.json({
      ok: true,
      ...resultado,
      pdfListaBase64: pdfBuffer.toString('base64'),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al generar reporte'
    console.error('suspensiones/generar:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
