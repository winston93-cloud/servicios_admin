import { NextResponse } from 'next/server'
import { obtenerCicloEscolarActual } from '@/lib/ciclosEscolaresService'
import { formaIngresoPorDefecto } from '@/lib/alumnoFormaIngreso'
import { listarPagosColegiaturaAlumno } from '@/lib/pagoColegiaturaService'
import { validarAlumnoPortal } from '@/lib/portalApiAlumnoAuth'
import { documentosNiYaEnviados } from '@/lib/portalDocumentosNiService'
import { resolverCicloPagoInscripcionPortal } from '@/lib/portalInscripcionesCiclo'
import {
  inscripcionCompletaPagada,
  solicitudCapturada,
} from '@/lib/portalInscripcionesSolicitud'
import { calcularReinscripcionDiferido } from '@/lib/portalReinscripcionService'
import { generarPdfReciboFinalInscripcion } from '@/lib/reciboFinalInscripcionPdf'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const alumnoId = Number(new URL(request.url).searchParams.get('alumnoId'))
    const auth = await validarAlumnoPortal(alumnoId)
    if (!auth.ok) return auth.response

    const alumno = auth.alumno
    const cicloSistema = await obtenerCicloEscolarActual()
    if (!cicloSistema) {
      return NextResponse.json({ error: 'Ciclo escolar no configurado' }, { status: 503 })
    }

    const supabase = createSupabaseAdmin()
    const esReinscrito = formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso) === 0
    const calc = esReinscrito
      ? await calcularReinscripcionDiferido(supabase, alumno)
      : null

    const cicloPago = await resolverCicloPagoInscripcionPortal(
      alumno,
      cicloSistema,
      calc?.cicloReinscripcion
    )
    const pagos = await listarPagosColegiaturaAlumno(alumno.alumno_id, cicloPago.valor)
    const solOk = await solicitudCapturada(supabase, alumno)
    const insPagada = calc
      ? Boolean(calc.completa)
      : inscripcionCompletaPagada(pagos, alumno.alumno_ref, cicloPago.valor)

    let docsOk = true
    if (!esReinscrito) {
      docsOk = await documentosNiYaEnviados(
        supabase,
        alumno.alumno_id,
        Number(cicloPago.valor)
      )
    }

    if (!solOk || !insPagada || !docsOk) {
      return NextResponse.json(
        {
          error:
            'Aún no puedes imprimir el recibo final. Completa solicitud, pago' +
            (esReinscrito ? '' : ' y documentos') +
            '.',
        },
        { status: 403 }
      )
    }

    const nombre =
      `${alumno.alumno_nombre ?? ''} ${alumno.alumno_app ?? ''} ${alumno.alumno_apm ?? ''}`.trim() ||
      'Alumno'
    const nivelPdf = esReinscrito
      ? Number(calc?.nivelDestino ?? alumno.alumno_nivel)
      : Number(alumno.alumno_nivel)
    const gradoPdf = esReinscrito
      ? Number(
          calc?.graduado ? alumno.alumno_grado : (calc?.gradoDestino ?? alumno.alumno_grado)
        )
      : Number(alumno.alumno_grado)
    const cicloPdf = esReinscrito
      ? Number(calc?.cicloReinscripcion ?? cicloSistema.valor)
      : Number(alumno.alumno_ciclo_escolar) || cicloSistema.valor

    const pdf = await generarPdfReciboFinalInscripcion({
      nombreAlumno: nombre,
      alumnoRef: Number(alumno.alumno_ref),
      nivel: nivelPdf,
      grado: gradoPdf,
      cicloEscolar: cicloPdf,
      formaIngresoEtiqueta: esReinscrito ? 'Reinscrito' : 'Nuevo ingreso',
    })

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="recibo-final-${alumno.alumno_ref}.pdf"`,
      },
    })
  } catch (e) {
    console.error('portal-inscripciones/recibo-final:', e)
    return NextResponse.json({ error: 'Error al generar el recibo final' }, { status: 500 })
  }
}
