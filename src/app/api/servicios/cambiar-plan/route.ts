import { NextResponse } from 'next/server'
import { cookieUsuariosValida } from '@/lib/usuariosCatalogoAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { obtenerAlumnoPorId, obtenerAlumnoPorRef } from '@/lib/alumnoDatosService'
import {
  cambiarPlanMesesAdmin,
  consultarEstadoCambiarPlan,
} from '@/lib/cambiarPlanMesesService'

export const runtime = 'nodejs'

function exigirPin(request: Request): NextResponse | null {
  if (cookieUsuariosValida(request.headers.get('cookie'))) return null
  return NextResponse.json(
    { error: 'PIN requerido para cambiar el plan de meses.' },
    { status: 401 }
  )
}

async function resolverAlumno(opts: {
  alumnoId?: number
  alumnoRef?: string
  cicloValor: number
}) {
  if (opts.alumnoId && Number.isFinite(opts.alumnoId) && opts.alumnoId > 0) {
    return obtenerAlumnoPorId(opts.alumnoId)
  }
  const ref = String(opts.alumnoRef ?? '').trim()
  if (!ref) return null
  return (
    (await obtenerAlumnoPorRef(ref, opts.cicloValor)) ?? (await obtenerAlumnoPorRef(ref))
  )
}

/** Estado del plan y si se puede cambiar (sin colegiatura septiembre pagada). */
export async function GET(request: Request) {
  const denegado = exigirPin(request)
  if (denegado) return denegado

  try {
    const url = new URL(request.url)
    const cicloValor = Number(url.searchParams.get('cicloValor'))
    const alumnoId = Number(url.searchParams.get('alumnoId'))
    const alumnoRef = url.searchParams.get('alumnoRef') ?? ''

    if (!Number.isFinite(cicloValor) || cicloValor <= 0) {
      return NextResponse.json({ error: 'cicloValor es obligatorio' }, { status: 400 })
    }

    const alumno = await resolverAlumno({
      alumnoId: Number.isFinite(alumnoId) ? alumnoId : undefined,
      alumnoRef,
      cicloValor,
    })
    if (!alumno) {
      return NextResponse.json({ error: 'Alumno no encontrado.' }, { status: 404 })
    }

    const supabase = createSupabaseAdmin()
    const estado = await consultarEstadoCambiarPlan(supabase, alumno, cicloValor)
    return NextResponse.json({ ok: true, ...estado })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al consultar el plan'
    console.error('GET /api/servicios/cambiar-plan:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Cambia plan 10 u 11 meses si no hay colegiatura de septiembre pagada. */
export async function POST(request: Request) {
  const denegado = exigirPin(request)
  if (denegado) return denegado

  try {
    const body = (await request.json().catch(() => ({}))) as {
      alumnoId?: number
      alumnoRef?: string
      cicloValor?: number
      planMeses?: number
    }

    const cicloValor = Number(body.cicloValor)
    const planMeses = Number(body.planMeses)
    const alumnoId = Number(body.alumnoId)

    if (!Number.isFinite(cicloValor) || cicloValor <= 0) {
      return NextResponse.json({ error: 'cicloValor es obligatorio' }, { status: 400 })
    }
    if (planMeses !== 1 && planMeses !== 2) {
      return NextResponse.json(
        { error: 'planMeses debe ser 1 (10 meses) o 2 (11 meses)' },
        { status: 400 }
      )
    }

    const alumno = await resolverAlumno({
      alumnoId: Number.isFinite(alumnoId) ? alumnoId : undefined,
      alumnoRef: body.alumnoRef,
      cicloValor,
    })
    if (!alumno) {
      return NextResponse.json({ error: 'Alumno no encontrado.' }, { status: 404 })
    }

    const supabase = createSupabaseAdmin()
    const resultado = await cambiarPlanMesesAdmin(supabase, alumno, cicloValor, planMeses)

    if (!resultado.ok) {
      return NextResponse.json({ ok: false, error: resultado.error }, { status: 422 })
    }

    return NextResponse.json({
      ok: true,
      planMeses: resultado.planMeses,
      planEtiqueta: resultado.planEtiqueta,
      cambiado: resultado.cambiado,
      bloqueadoPorSeptiembre: resultado.bloqueadoPorSeptiembre,
      alumnoId: alumno.alumno_id,
      alumnoRef: String(alumno.alumno_ref),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al cambiar el plan'
    console.error('POST /api/servicios/cambiar-plan:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
