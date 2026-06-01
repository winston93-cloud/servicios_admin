import { NextResponse } from 'next/server'
import { obtenerAlumnoPorId } from '@/lib/alumnoDatosService'
import { normalizarConceptoNo } from '@/lib/boucherCore'
import { calcularBoucher } from '@/lib/boucherService'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { crearCargoSpeiOpenpay } from '@/lib/openpaySpeiService'
import {
  generarReferenciaSpeiDesdePago,
  obtenerConfigOpenpay,
} from '@/lib/portalPagosSpei'

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

    const supabase = createSupabaseAdmin()
    const planMeses = alumno.mes === 2 ? 2 : 1
    const { importe } = await calcularBoucher(supabase, {
      alumnoId,
      alumnoRef: alumno.alumno_ref,
      alumnoNivel: alumno.alumno_nivel,
      alumnoGrado: Number(alumno.alumno_grado) || 0,
      conceptoNo,
      cicloEscolar,
      planMeses,
    })

    if (importe <= 0) {
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

    const config = obtenerConfigOpenpay(alumno.alumno_nivel)
    const cargo = await crearCargoSpeiOpenpay({
      config,
      amount: importe,
      description: conceptoClase,
      orderId: referenciaSpei,
      customerName: nombreAlumno || 'Alumno Winston',
      deviceSessionId,
    })

    return NextResponse.json({
      ok: true,
      referenciaSpei: cargo.orderId,
      importe,
      speiPdfUrl: cargo.speiPdfUrl,
      chargeId: cargo.chargeId,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo generar el recibo SPEI'
    console.error('portal-pagos/spei:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
