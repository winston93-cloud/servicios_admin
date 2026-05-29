import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { listarPreciosPorCiclo } from '@/lib/boucherService'
import { numeroCicloEscolarAdmin } from '@/lib/cicloEscolarAdmin'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    let ciclo = Number(url.searchParams.get('ciclo'))
    if (!ciclo || Number.isNaN(ciclo)) {
      ciclo = numeroCicloEscolarAdmin()
    }

    const supabase = createSupabaseAdmin()
    const filas = await listarPreciosPorCiclo(supabase, ciclo)

    return NextResponse.json({ ok: true, cicloEscolar: ciclo, filas })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar precios'
    console.error('bauchers/precios:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
