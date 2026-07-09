import { NextResponse } from 'next/server'
import { obtenerCicloEscolarActual } from '@/lib/ciclosEscolaresService'
import { listarPagosColegiaturaAlumno } from '@/lib/pagoColegiaturaService'
import { validarAlumnoPortal } from '@/lib/portalApiAlumnoAuth'
import { construirEstadoPortalInscripciones } from '@/lib/portalInscripcionesService'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const alumnoId = Number(body.alumnoId)

    const auth = await validarAlumnoPortal(alumnoId)
    if (!auth.ok) return auth.response

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

    const alumno = auth.alumno
    const supabase = createSupabaseAdmin()
    const pagos = await listarPagosColegiaturaAlumno(alumno.alumno_id, ciclo.valor)
    const estado = await construirEstadoPortalInscripciones(supabase, alumno, ciclo, pagos)

    return NextResponse.json({ ok: true, estado })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar inscripciones'
    console.error('portal-inscripciones/estado:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
