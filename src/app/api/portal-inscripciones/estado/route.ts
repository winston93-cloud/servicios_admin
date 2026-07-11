import { NextResponse } from 'next/server'
import { obtenerCicloEscolarActual } from '@/lib/ciclosEscolaresService'
import { listarPagosColegiaturaAlumno } from '@/lib/pagoColegiaturaService'
import { validarAlumnoPortal } from '@/lib/portalApiAlumnoAuth'
import { construirEstadoPortalInscripciones } from '@/lib/portalInscripcionesService'
import { resolverCicloPagoInscripcionPortal } from '@/lib/portalInscripcionesCiclo'
import { formaIngresoPorDefecto } from '@/lib/alumnoFormaIngreso'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const alumnoId = Number(body.alumnoId)

    const auth = await validarAlumnoPortal(alumnoId)
    if (!auth.ok) return auth.response

    const cicloSistema = await obtenerCicloEscolarActual()
    if (!cicloSistema) {
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
    const esReinscrito = formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso) === 0

    // NI: pagos del ciclo de la ficha. Reinscrito: del ciclo en curso (adeudos/cea).
    const cicloPagos = esReinscrito
      ? cicloSistema
      : await resolverCicloPagoInscripcionPortal(alumno, cicloSistema)
    const pagos = await listarPagosColegiaturaAlumno(alumno.alumno_id, cicloPagos.valor)
    const estado = await construirEstadoPortalInscripciones(
      supabase,
      alumno,
      cicloSistema,
      pagos
    )

    return NextResponse.json({ ok: true, estado })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar inscripciones'
    console.error('portal-inscripciones/estado:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
