import { NextResponse } from 'next/server'
import { cookieUsuariosValida } from '@/lib/usuariosCatalogoAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { obtenerAlumnoPorId, obtenerAlumnoPorRef } from '@/lib/alumnoDatosService'
import {
  activarCargoExtra,
  consultarEstadoCargoExtra,
  desactivarCargoExtra,
} from '@/lib/alumnoCargoExtraService'

export const runtime = 'nodejs'

function exigirPin(request: Request): NextResponse | null {
  if (cookieUsuariosValida(request.headers.get('cookie'))) return null
  return NextResponse.json(
    { error: 'PIN requerido para el módulo Cargo Extra.' },
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
    const estado = await consultarEstadoCargoExtra(supabase, alumno, cicloValor)
    return NextResponse.json({ ok: true, ...estado })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al consultar cargo extra'
    console.error('GET /api/servicios/cargo-extra:', e)
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
      monto?: number
      motivo?: string
      activadoPor?: string
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
      const r = await desactivarCargoExtra(supabase, alumno, cicloValor, body.motivo)
      if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 422 })
      return NextResponse.json({ ok: true, ...r.estado })
    }

    if (accion === 'activar') {
      const r = await activarCargoExtra(supabase, alumno, cicloValor, {
        monto: body.monto,
        activadoPor: body.activadoPor,
      })
      if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 422 })
      return NextResponse.json({ ok: true, ...r.estado })
    }

    return NextResponse.json(
      { error: 'accion debe ser activar o desactivar' },
      { status: 400 }
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error en cargo extra'
    console.error('POST /api/servicios/cargo-extra:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
