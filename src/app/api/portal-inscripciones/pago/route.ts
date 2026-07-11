import { NextResponse } from 'next/server'
import { obtenerCicloEscolarActual } from '@/lib/ciclosEscolaresService'
import { listarPagosColegiaturaAlumno } from '@/lib/pagoColegiaturaService'
import { validarAlumnoPortal } from '@/lib/portalApiAlumnoAuth'
import { construirVistaPagoInscripcion } from '@/lib/portalInscripcionPagoService'
import { resolverCicloPagoInscripcionPortal } from '@/lib/portalInscripcionesCiclo'
import { calcularReinscripcionDiferido } from '@/lib/portalReinscripcionService'
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
    const calcReinscripcion = esReinscrito
      ? await calcularReinscripcionDiferido(supabase, alumno)
      : null
    const ciclo = await resolverCicloPagoInscripcionPortal(
      alumno,
      cicloSistema,
      calcReinscripcion?.cicloReinscripcion
    )
    const pagos = await listarPagosColegiaturaAlumno(alumno.alumno_id, ciclo.valor)
    const vista = await construirVistaPagoInscripcion(
      supabase,
      alumno,
      cicloSistema,
      pagos
    )

    return NextResponse.json({ ok: true, vista })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar pago de inscripción'
    console.error('portal-inscripciones/pago:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
