import { NextResponse } from 'next/server'
import { obtenerAlumnoPorId } from '@/lib/alumnoDatosService'
import { esEstatusBloqueo } from '@/lib/alumnoStatus'
import { normalizarConceptoNo } from '@/lib/boucherCore'
import { obtenerCicloEscolarActual } from '@/lib/ciclosEscolaresService'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { crearCargoSpeiOpenpay } from '@/lib/openpaySpeiService'
import {
  esConceptoInscripcionReinscripcion,
  nivelCobroElectronico,
} from '@/lib/nivelCobroElectronico'
import {
  generarReferenciaSpeiDesdePago,
  obtenerConfigOpenpay,
} from '@/lib/portalPagosSpei'
import { resolverImportePagoElectronico } from '@/lib/portalPagoElectronicoImporte'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const alumnoId = Number(body.alumnoId)
    const conceptoNo = normalizarConceptoNo(body.conceptoNo)
    const cicloEscolar = Number(body.cicloEscolar)
    const deviceSessionId =
      typeof body.deviceSessionId === 'string' ? body.deviceSessionId : undefined

    if (!alumnoId || !cicloEscolar || !conceptoNo) {
      return NextResponse.json(
        { error: 'alumnoId, conceptoNo y cicloEscolar son obligatorios' },
        { status: 400 }
      )
    }

    const alumno = await obtenerAlumnoPorId(alumnoId)
    if (!alumno) {
      return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 })
    }

    const cicloSistema = await obtenerCicloEscolarActual()
    const cicloTemporada =
      body.cicloTemporada != null && Number.isFinite(Number(body.cicloTemporada))
        ? Number(body.cicloTemporada)
        : cicloSistema?.valor

    // Bloqueo 4/5: solo colegiaturas del ciclo anterior; no inscripción del ciclo nuevo.
    if (
      esEstatusBloqueo(alumno.alumno_status) &&
      esConceptoInscripcionReinscripcion(conceptoNo)
    ) {
      return NextResponse.json(
        {
          error:
            'No puedes pagar inscripción con bloqueo académico o psicológico. Solo colegiaturas pendientes del ciclo anterior.',
        },
        { status: 403 }
      )
    }
    if (
      esEstatusBloqueo(alumno.alumno_status) &&
      cicloTemporada != null &&
      cicloEscolar >= cicloTemporada
    ) {
      return NextResponse.json(
        {
          error:
            'Con bloqueo académico o psicológico solo puedes pagar pendientes del ciclo anterior.',
        },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()
    const { resolverPlanMesesParaCiclo } = await import('@/lib/portalPlanMesesCiclo')
    const planMeses = await resolverPlanMesesParaCiclo(supabase, alumno, cicloEscolar)

    const { importe, importeLinea, recargo, montoCobro } = await resolverImportePagoElectronico({
      db: supabase,
      alumno,
      conceptoNo,
      cicloEscolar,
      cicloTemporada,
      planMeses,
      importeCliente: body.importe,
    })

    const montoSpei = montoCobro > 0 ? montoCobro : importeLinea > 0 ? importeLinea : importe

    if (montoSpei <= 0) {
      return NextResponse.json({ error: 'Importe inválido para SPEI' }, { status: 400 })
    }

    const referenciaSpei = generarReferenciaSpeiDesdePago(
      alumno.alumno_ref,
      conceptoNo,
      cicloEscolar
    )

    const conceptoClase =
      typeof body.conceptoClase === 'string' && body.conceptoClase.trim()
        ? body.conceptoClase.trim()
        : `Concepto ${conceptoNo}`

    const nombreAlumno =
      typeof body.nombreAlumno === 'string' && body.nombreAlumno.trim()
        ? body.nombreAlumno.trim()
        : `${alumno.alumno_app ?? ''} ${alumno.alumno_apm ?? ''} ${alumno.alumno_nombre ?? ''}`.trim()

    const nivelCobro = nivelCobroElectronico(alumno, conceptoNo, cicloTemporada)
    const config = obtenerConfigOpenpay(nivelCobro)
    const cargo = await crearCargoSpeiOpenpay({
      config,
      amount: montoSpei,
      description:
        recargo > 0
          ? `${conceptoClase} (incluye recargo $${recargo.toFixed(2)})`
          : conceptoClase,
      orderId: referenciaSpei,
      customerName: nombreAlumno || 'Alumno Winston',
      deviceSessionId,
    })

    return NextResponse.json({
      ok: true,
      referenciaSpei: cargo.orderId,
      importe: montoSpei,
      recargo,
      speiPdfUrl: cargo.speiPdfUrl,
      chargeId: cargo.chargeId,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo generar el recibo SPEI'
    console.error('portal-pagos/spei:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
