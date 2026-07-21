import { NextResponse } from 'next/server'
import { validarAlumnoPortal } from '@/lib/portalApiAlumnoAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  alumnoTienePagosColegiaturaCiclo,
  actualizarPlanMesesPortal,
} from '@/lib/portalPlanPagosService'
import { etiquetaPlanMeses } from '@/lib/alumnoPlanMeses'
import { resolverPlanMesesParaCiclo } from '@/lib/portalPlanMesesCiclo'

export const runtime = 'nodejs'

/** Estado actual del plan (para la modal) y si ya se puede cambiar. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const alumnoId = Number(url.searchParams.get('alumnoId'))
    const cicloValor = Number(url.searchParams.get('cicloValor'))

    const auth = await validarAlumnoPortal(alumnoId)
    if (!auth.ok) return auth.response

    if (!Number.isFinite(cicloValor) || cicloValor <= 0) {
      return NextResponse.json({ error: 'cicloValor es obligatorio' }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()
    const planMeses = await resolverPlanMesesParaCiclo(supabase, auth.alumno, cicloValor)
    const bloqueadoPorPagos = await alumnoTienePagosColegiaturaCiclo(auth.alumno, cicloValor)

    return NextResponse.json({
      ok: true,
      planMeses,
      planEtiqueta: etiquetaPlanMeses(planMeses),
      bloqueadoPorPagos,
      puedeCambiar: !bloqueadoPorPagos,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al consultar plan de pagos'
    console.error('portal-inscripciones/plan-pagos GET:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** Confirma / cambia plan 10 u 11 meses antes de armar colegiaturas del ciclo nuevo. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const alumnoId = Number(body.alumnoId)
    const planMeses = Number(body.planMeses)
    const cicloValor = Number(body.cicloValor)

    if (!alumnoId || (planMeses !== 1 && planMeses !== 2)) {
      return NextResponse.json(
        { error: 'alumnoId y planMeses (1 o 2) son obligatorios' },
        { status: 400 }
      )
    }
    if (!Number.isFinite(cicloValor) || cicloValor <= 0) {
      return NextResponse.json({ error: 'cicloValor es obligatorio' }, { status: 400 })
    }

    const auth = await validarAlumnoPortal(alumnoId)
    if (!auth.ok) return auth.response

    const supabase = createSupabaseAdmin()
    const resultado = await actualizarPlanMesesPortal(
      supabase,
      auth.alumno,
      planMeses,
      cicloValor
    )

    if (!resultado.ok) {
      return NextResponse.json({ ok: false, error: resultado.error }, { status: 422 })
    }

    return NextResponse.json({
      ok: true,
      planMeses: resultado.planMeses,
      planEtiqueta: resultado.planEtiqueta,
      bloqueadoPorPagos: resultado.bloqueadoPorPagos,
      cambiado: resultado.cambiado,
      mesFichaConservado: Boolean(resultado.mesFichaConservado),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al guardar plan de pagos'
    console.error('portal-inscripciones/plan-pagos POST:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
