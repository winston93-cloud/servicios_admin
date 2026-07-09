import { NextResponse } from 'next/server'
import {
  cargarSolicitudInscripcion,
  guardarSolicitudInscripcion,
} from '@/lib/portalInscripcionesSolicitudService'
import type { SolicitudInscripcionFormulario } from '@/lib/portalInscripcionesSolicitudTypes'
import { validarAlumnoPortal } from '@/lib/portalApiAlumnoAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const alumnoId = Number(new URL(request.url).searchParams.get('alumnoId'))
    const auth = await validarAlumnoPortal(alumnoId)
    if (!auth.ok) return auth.response

    const supabase = createSupabaseAdmin()
    const formulario = await cargarSolicitudInscripcion(supabase, alumnoId)

    return NextResponse.json({
      ok: true,
      formulario,
      alumnoRegistro: auth.alumno.alumno_registro ?? null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar solicitud'
    console.error('portal-inscripciones/solicitud GET:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const alumnoId = Number(body.alumnoId)
    const formulario = body.formulario as SolicitudInscripcionFormulario

    if (!alumnoId || !formulario) {
      return NextResponse.json({ error: 'alumnoId y formulario son obligatorios' }, { status: 400 })
    }

    const auth = await validarAlumnoPortal(alumnoId)
    if (!auth.ok) return auth.response

    const supabase = createSupabaseAdmin()
    const resultado = await guardarSolicitudInscripcion(supabase, alumnoId, formulario)

    if (!resultado.ok) {
      return NextResponse.json({ ok: false, errores: resultado.errores }, { status: 422 })
    }

    return NextResponse.json({ ok: true, fechaRegistro: resultado.fechaRegistro })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al guardar solicitud'
    console.error('portal-inscripciones/solicitud POST:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
