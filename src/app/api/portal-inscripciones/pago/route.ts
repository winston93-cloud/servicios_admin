import { NextResponse } from 'next/server'
import { obtenerCicloEscolarActual } from '@/lib/ciclosEscolaresService'
import { listarPagosColegiaturaAlumno } from '@/lib/pagoColegiaturaService'
import { validarAlumnoPortal } from '@/lib/portalApiAlumnoAuth'
import { construirVistaPagoInscripcion } from '@/lib/portalInscripcionPagoService'
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
    const vista = await construirVistaPagoInscripcion(supabase, alumno, ciclo, pagos)

    return NextResponse.json({ ok: true, vista })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar pago de inscripción'
    console.error('portal-inscripciones/pago:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
