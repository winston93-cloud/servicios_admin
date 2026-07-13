import { NextResponse } from 'next/server'
import { obtenerCicloEscolarActual, obtenerCicloPorValor } from '@/lib/ciclosEscolaresService'
import { listarPagosColegiaturaAlumno } from '@/lib/pagoColegiaturaService'
import { validarAlumnoPortal } from '@/lib/portalApiAlumnoAuth'
import { construirEstadoPortalInscripciones } from '@/lib/portalInscripcionesService'
import { resolverCicloPagoInscripcionPortal } from '@/lib/portalInscripcionesCiclo'
import { formaIngresoPorDefecto } from '@/lib/alumnoFormaIngreso'
import { cicloCierreValor } from '@/lib/portalCierreCicloAnterior'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
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

    // NI: pagos del ciclo de la ficha. Reinscrito: pagos del ciclo destino (reinscripción).
    const cicloPagos = esReinscrito
      ? cicloSistema
      : await resolverCicloPagoInscripcionPortal(alumno, cicloSistema)
    const pagos = await listarPagosColegiaturaAlumno(alumno.alumno_id, cicloPagos.valor)

    let opciones:
      | {
          pagosCierre: Awaited<ReturnType<typeof listarPagosColegiaturaAlumno>>
          cicloCierre: { valor: number; nombre: string }
        }
      | undefined

    if (esReinscrito) {
      const valorCierre = cicloCierreValor(cicloSistema.valor)
      const cicloCierreReg = await obtenerCicloPorValor(valorCierre)
      const cicloCierre = cicloCierreReg
        ? { valor: cicloCierreReg.valor, nombre: cicloCierreReg.nombre }
        : {
            valor: valorCierre,
            nombre: etiquetaCicloEscolar(valorCierre) || String(valorCierre),
          }
      const pagosCierre = await listarPagosColegiaturaAlumno(
        alumno.alumno_id,
        cicloCierre.valor
      )
      opciones = {
        pagosCierre,
        cicloCierre,
      }
    }

    const estado = await construirEstadoPortalInscripciones(
      supabase,
      alumno,
      cicloSistema,
      pagos,
      opciones
    )

    return NextResponse.json({ ok: true, estado })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar inscripciones'
    console.error('portal-inscripciones/estado:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
