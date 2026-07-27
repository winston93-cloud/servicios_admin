import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { calcularBoucher } from '@/lib/boucherService'
import {
  conceptoBoucherAusente,
  getPaymentConcept,
  normalizarConceptoNo,
  parseImporteBoucher,
  vigenciaBoucherParaConcepto,
} from '@/lib/boucherCore'
import { generarPdfBoucher } from '@/lib/boucherPdf'
import { obtenerAlumnoPorId } from '@/lib/alumnoDatosService'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const alumnoId = Number(body.alumnoId)
    const conceptoNo = normalizarConceptoNo(body.conceptoNo)
    const conceptoClase =
      String(body.conceptoClase ?? '').trim() || getPaymentConcept(conceptoNo)
    const cicloEscolar = Number(body.cicloEscolar)
    // Cuota 00: forzar 10 ago del ciclo (ignora vigencia corta del cliente).
    const vigencia =
      conceptoNo === '00' && Number.isFinite(cicloEscolar) && cicloEscolar > 0
        ? vigenciaBoucherParaConcepto(conceptoNo, cicloEscolar)
        : String(body.vigencia ?? '')
    const importe = parseImporteBoucher(body.importe)
    const referencia = String(body.referencia ?? '').replace(/\D/g, '')
    const aplicarRecargos = Boolean(body.aplicarRecargos)
    const ignorarMesPago = Boolean(body.ignorarMesPago)
    const nombreAlumno = String(body.nombreAlumno ?? '')

    if (!alumnoId || conceptoBoucherAusente(body.conceptoNo) || !cicloEscolar || !vigencia) {
      return NextResponse.json(
        { error: 'Completa alumno, concepto, ciclo y vigencia' },
        { status: 400 }
      )
    }

    if (!importe || importe <= 0 || !referencia) {
      return NextResponse.json(
        { error: 'Importe y referencia son obligatorios' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()
    const alumno = await obtenerAlumnoPorId(alumnoId)
    if (!alumno) {
      return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 })
    }

    const verificado = await calcularBoucher(supabase, {
      alumnoId,
      alumnoRef: alumno.alumno_ref,
      alumnoNivel: alumno.alumno_nivel,
      alumnoGrado: Number(alumno.alumno_grado) || 0,
      conceptoNo,
      cicloEscolar,
      importeManual: importe,
      planMeses: alumno.mes === 2 ? 2 : 1,
    })

    if (verificado.referencia !== referencia) {
      return NextResponse.json(
        { error: 'La referencia no coincide con el importe. Recalcula antes de generar.' },
        { status: 400 }
      )
    }

    const pdfBuffer = generarPdfBoucher({
      nombreAlumno: nombreAlumno || `${alumno.alumno_app} ${alumno.alumno_apm} ${alumno.alumno_nombre}`.trim(),
      alumnoNivel: alumno.alumno_nivel,
      alumnoGrado: Number(alumno.alumno_grado) || 0,
      conceptoNo,
      conceptoClase,
      referencia,
      importe,
      vigencia,
      cicloEscolar,
      aplicarRecargos,
      ignorarMesPago,
    })

    return NextResponse.json({
      ok: true,
      pdfBase64: pdfBuffer.toString('base64'),
      referencia,
      importe,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al generar baucher'
    console.error('bauchers/generar:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
