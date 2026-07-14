import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { obtenerAlumnoPorId } from '@/lib/alumnoDatosService'
import { formaIngresoPorDefecto } from '@/lib/alumnoFormaIngreso'
import {
  obtenerCicloEscolarActual,
  obtenerCicloPorValor,
  type CicloEscolarRegistro,
} from '@/lib/ciclosEscolaresService'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
import { listarPagosColegiaturaAlumno } from '@/lib/pagoColegiaturaService'
import { asegurarColegiaturasPreviasIngresoCero } from '@/lib/colegiaturasPreviasIngresoService'
import { construirMatrizPortalPagos } from '@/lib/portalPagosMatrizService'
import { resolverCicloPagoInscripcionPortal } from '@/lib/portalInscripcionesCiclo'
import { proyectarReinscripcionAlumno } from '@/lib/portalReinscripcionProyeccion'

export const runtime = 'nodejs'

function cicloFallback(valor: number): CicloEscolarRegistro {
  const anioInicio = 2003 + valor
  return {
    id: 0,
    valor,
    nombre: etiquetaCicloEscolar(valor) || `${anioInicio}-${anioInicio + 1}`,
    anio_inicio: anioInicio,
    anio_fin: anioInicio + 1,
    activo: true,
    es_actual: false,
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const alumnoId = Number(body.alumnoId)
    const cicloValor = body.cicloValor != null ? Number(body.cicloValor) : null
    const soloColegiatura = Boolean(body.soloColegiatura)

    if (!alumnoId) {
      return NextResponse.json({ error: 'alumnoId es obligatorio' }, { status: 400 })
    }

    const alumno = await obtenerAlumnoPorId(alumnoId)
    if (!alumno) {
      return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 })
    }

    const cicloSistema = await obtenerCicloEscolarActual()
    if (!cicloSistema && !(cicloValor != null && Number.isFinite(cicloValor) && cicloValor > 0)) {
      return NextResponse.json(
        {
          error:
            'No hay ciclo escolar vigente configurado. Contacta a servicios escolares.',
        },
        { status: 503 }
      )
    }

    let ciclo: CicloEscolarRegistro | null = null
    if (cicloValor != null && Number.isFinite(cicloValor) && cicloValor > 0) {
      ciclo = (await obtenerCicloPorValor(cicloValor)) ?? cicloFallback(cicloValor)
    } else if (cicloSistema && !soloColegiatura) {
      // Colegiaturas del ciclo a pagar: reinscrito → destino (ej. 23); NI → ficha.
      const proy =
        formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso) === 0
          ? proyectarReinscripcionAlumno(alumno)
          : null
      ciclo = await resolverCicloPagoInscripcionPortal(
        alumno,
        cicloSistema,
        proy?.cicloDestino
      )
    } else {
      ciclo = cicloSistema
    }

    if (!ciclo) {
      return NextResponse.json(
        {
          error:
            'No hay ciclo escolar vigente configurado. Contacta a servicios escolares.',
        },
        { status: 503 }
      )
    }

    const supabase = createSupabaseAdmin()
    let pagos = await listarPagosColegiaturaAlumno(alumnoId, ciclo.valor)
    const previos = await asegurarColegiaturasPreviasIngresoCero(
      supabase,
      alumno,
      ciclo.valor,
      pagos
    )
    if (previos.insertados.length > 0) {
      pagos = await listarPagosColegiaturaAlumno(alumnoId, ciclo.valor)
    }
    const matriz = await construirMatrizPortalPagos(supabase, alumno, ciclo, pagos, {
      soloColegiatura,
    })

    return NextResponse.json({
      ok: true,
      matriz,
      colegiaturasPreviasCero: previos.insertados,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar matriz de pagos'
    console.error('portal-pagos/matriz:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
