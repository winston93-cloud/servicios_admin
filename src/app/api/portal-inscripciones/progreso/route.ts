import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { obtenerAlumnoPorId } from '@/lib/alumnoDatosService'
import { marcarPortalInscripcionProgreso } from '@/lib/portalInscripcionProgreso'

export const runtime = 'nodejs'

/**
 * Persiste en servidor que el papá ya abrió reglamento / recibo / confirmó plan,
 * para que en otra PC no se pidan de nuevo.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const alumnoId = Number(body.alumnoId)
    const cicloValor = Number(body.cicloValor)
    if (!Number.isFinite(alumnoId) || alumnoId <= 0) {
      return NextResponse.json({ error: 'alumnoId inválido' }, { status: 400 })
    }
    if (!Number.isFinite(cicloValor) || cicloValor <= 0) {
      return NextResponse.json({ error: 'cicloValor inválido' }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()
    const alumno = await obtenerAlumnoPorId(alumnoId)
    if (!alumno) {
      return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 })
    }

    const marca = {
      reglamento_visto: Boolean(body.reglamento_visto),
      recibo_final_visto: Boolean(body.recibo_final_visto),
      plan_confirmado: Boolean(body.plan_confirmado),
    }
    if (
      !marca.reglamento_visto &&
      !marca.recibo_final_visto &&
      !marca.plan_confirmado
    ) {
      return NextResponse.json(
        { error: 'Indica al menos una marca de progreso.' },
        { status: 400 }
      )
    }

    const res = await marcarPortalInscripcionProgreso(
      supabase,
      alumnoId,
      cicloValor,
      marca
    )
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al guardar progreso'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
