import { NextResponse } from 'next/server'
import { cookieUsuariosValida } from '@/lib/usuariosCatalogoAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { obtenerAlumnoPorId, obtenerAlumnoPorRef } from '@/lib/alumnoDatosService'
import { crearPagoColegiaturaManual } from '@/lib/pagoColegiaturaService'
import {
  activarPagoColegiaturasPaquete,
  aplicarCoberturaTrasPagoColegiaturas,
  CONCEPTO_PAGO_COLEGIATURAS,
  consultarEstadoPagoColegiaturasPaquete,
  etiquetaPagoColegiaturas,
  revertirPagoColegiaturasPaquete,
} from '@/lib/pagoColegiaturasPaqueteService'

export const runtime = 'nodejs'

function exigirPin(request: Request): NextResponse | null {
  if (cookieUsuariosValida(request.headers.get('cookie'))) return null
  return NextResponse.json(
    { error: 'PIN requerido para Pagos de Colegiaturas.' },
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

    const estado = await consultarEstadoPagoColegiaturasPaquete(
      createSupabaseAdmin(),
      alumno,
      cicloValor
    )
    return NextResponse.json({ ok: true, ...estado })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al consultar el paquete'
    console.error('GET /api/servicios/pagos-colegiaturas-paquete:', e)
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
      conceptos?: string[]
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

    if (accion === 'revertir' || accion === 'desactivar') {
      const r = await revertirPagoColegiaturasPaquete(supabase, alumno, cicloValor)
      if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 422 })
      return NextResponse.json({ ok: true, ...r.estado })
    }

    if (accion === 'activar') {
      const r = await activarPagoColegiaturasPaquete(
        supabase,
        alumno,
        cicloValor,
        body.conceptos ?? []
      )
      if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 422 })
      return NextResponse.json({ ok: true, ...r.estado })
    }

    if (accion === 'pago-efectivo') {
      const estado = await consultarEstadoPagoColegiaturasPaquete(supabase, alumno, cicloValor)
      if (!estado.activo || estado.pagado) {
        return NextResponse.json(
          {
            ok: false,
            error: estado.pagado
              ? 'El paquete ya está cobrado.'
              : 'Asigna las colegiaturas antes de registrar el cobro.',
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
        conceptoNo: CONCEPTO_PAGO_COLEGIATURAS,
        cicloEscolar: cicloValor,
        importe: estado.montoTotal,
        recargo: 0,
        fechaPago,
        formaPago: body.formaPago?.trim() || 'Efectivo',
      })

      if (!creado.ok) {
        return NextResponse.json({ ok: false, error: creado.mensaje }, { status: 422 })
      }

      const cobertura = await aplicarCoberturaTrasPagoColegiaturas(supabase, alumno, cicloValor, {
        fechaPago,
        importePagado: estado.montoTotal,
      })
      if (!cobertura.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: `Pago registrado, pero falló marcar los meses: ${cobertura.error}`,
            pagoId: creado.pagoId,
            referencia: creado.referencia,
          },
          { status: 422 }
        )
      }

      const estadoFinal = await consultarEstadoPagoColegiaturasPaquete(
        supabase,
        alumno,
        cicloValor
      )
      return NextResponse.json({
        ok: true,
        ...estadoFinal,
        pagoId: creado.pagoId,
        referencia: creado.referencia,
        mesesCubiertos: cobertura.insertados,
        conceptoEtiqueta: etiquetaPagoColegiaturas(),
      })
    }

    return NextResponse.json(
      { error: 'accion debe ser activar, revertir o pago-efectivo' },
      { status: 400 }
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error en pagos de colegiaturas'
    console.error('POST /api/servicios/pagos-colegiaturas-paquete:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
