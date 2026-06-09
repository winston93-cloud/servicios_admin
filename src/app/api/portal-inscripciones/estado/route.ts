import { NextResponse } from 'next/server'
import { obtenerAlumnoPorId } from '@/lib/alumnoDatosService'
import { obtenerCicloEscolarActual } from '@/lib/ciclosEscolaresService'
import { listarPagosColegiaturaAlumno } from '@/lib/pagoColegiaturaService'
import { construirEstadoPortalInscripciones } from '@/lib/portalInscripcionesService'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const alumnoId = Number(body.alumnoId)

    if (!alumnoId) {
      return NextResponse.json({ error: 'alumnoId es obligatorio' }, { status: 400 })
    }

    const ciclo = await obtenerCicloEscolarActual()
    if (!ciclo) {
      return NextResponse.json(
        {
          error:
            'No hay ciclo escolar vigente configurado. Contacta a servicios escolares.',
        },
        { status: 503 }
      )
    }

    const alumno = await obtenerAlumnoPorId(alumnoId)
    if (!alumno) {
      return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 })
    }

    const supabase = createSupabaseAdmin()
    const pagos = await listarPagosColegiaturaAlumno(alumnoId, ciclo.valor)
    const estado = await construirEstadoPortalInscripciones(supabase, alumno, ciclo, pagos)

    return NextResponse.json({ ok: true, estado })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar inscripciones'
    console.error('portal-inscripciones/estado:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
