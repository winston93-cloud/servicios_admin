import { NextResponse } from 'next/server'
import { cookieUsuariosValida } from '@/lib/usuariosCatalogoAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { obtenerAlumnoPorId, obtenerAlumnoPorRef } from '@/lib/alumnoDatosService'
import {
  activarPagoAnual,
  aplicarCoberturaTrasPagoAnual,
  consultarEstadoPagoAnual,
  desactivarPagoAnual,
} from '@/lib/pagoAnualService'
import { crearPagoColegiaturaManual } from '@/lib/pagoColegiaturaService'
import { CONCEPTO_PAGO_ANUAL } from '@/lib/pagoAnualService'

export const runtime = 'nodejs'

function exigirPin(request: Request): NextResponse | null {
  if (cookieUsuariosValida(request.headers.get('cookie'))) return null
  return NextResponse.json(
    { error: 'PIN requerido para el módulo Pago Anual.' },
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
    const estado = await consultarEstadoPagoAnual(supabase, alumno, cicloValor)
    return NextResponse.json({ ok: true, ...estado })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al consultar pago anual'
    console.error('GET /api/servicios/pago-anual:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const denegado = exigirPin(request)
  if (denegado) return denegado

  try {
    const body = (await request.json().catch(() => ({}))) as {
      accion?: string
      alumnoId?: number
      alumnoRef?: string
      cicloValor?: number
      formaPago?: string
      fechaPago?: string
    }

    const cicloValor = Number(body.cicloValor)
    const accion = String(body.accion ?? 'activar').trim().toLowerCase()

    if (!Number.isFinite(cicloValor) || cicloValor <= 0) {
      return NextResponse.json({ error: 'cicloValor es obligatorio' }, { status: 400 })
    }

    const alumno = await resolverAlumno({
      alumnoId: Number(body.alumnoId),
      alumnoRef: body.alumnoRef,
      cicloValor,
    })
    if (!alumno) {
      return NextResponse.json({ error: 'Alumno no encontrado.' }, { status: 404 })
    }

    const supabase = createSupabaseAdmin()

    if (accion === 'desactivar') {
      const r = await desactivarPagoAnual(supabase, alumno, cicloValor)
      if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 422 })
      return NextResponse.json({ ok: true, ...r.estado })
    }

    if (accion === 'activar') {
      const r = await activarPagoAnual(supabase, alumno, cicloValor)
      if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 422 })
      return NextResponse.json({ ok: true, ...r.estado })
    }

    if (accion === 'pago-efectivo') {
      const estado = await consultarEstadoPagoAnual(supabase, alumno, cicloValor)
      if (!estado.activo || estado.pagado) {
        return NextResponse.json(
          {
            ok: false,
            error: estado.pagado
              ? 'El pago anual ya está registrado.'
              : 'Activa el pago anual antes de registrar el cobro.',
          },
          { status: 422 }
        )
      }

      const fechaPago =
        body.fechaPago && /^\d{4}-\d{2}-\d{2}$/.test(body.fechaPago)
          ? body.fechaPago
          : new Date().toISOString().slice(0, 10)

      const creado = await crearPagoColegiaturaManual({
        alumnoId: alumno.alumno_id,
        alumnoRef: String(alumno.alumno_ref),
        pagoNombre: estado.nombre,
        conceptoNo: CONCEPTO_PAGO_ANUAL,
        cicloEscolar: cicloValor,
        importe: estado.montoConDescuento,
        recargo: 0,
        fechaPago,
        formaPago: body.formaPago?.trim() || 'Efectivo',
      })

      if (!creado.ok) {
        return NextResponse.json({ ok: false, error: creado.mensaje }, { status: 422 })
      }

      const cobertura = await aplicarCoberturaTrasPagoAnual(supabase, alumno, cicloValor, {
        fechaPago,
        importePagado: estado.montoConDescuento,
      })
      if (!cobertura.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: `Pago registrado, pero falló la cobertura de meses: ${cobertura.error}`,
            pagoId: creado.pagoId,
            referencia: creado.referencia,
          },
          { status: 422 }
        )
      }

      const estadoFinal = await consultarEstadoPagoAnual(supabase, alumno, cicloValor)
      return NextResponse.json({
        ok: true,
        ...estadoFinal,
        pagoId: creado.pagoId,
        referencia: creado.referencia,
        mesesCubiertos: cobertura.insertados,
      })
    }

    return NextResponse.json(
      { error: 'accion debe ser activar, desactivar o pago-efectivo' },
      { status: 400 }
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error en pago anual'
    console.error('POST /api/servicios/pago-anual:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
