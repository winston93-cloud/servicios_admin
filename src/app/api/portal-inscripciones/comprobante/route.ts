import { NextResponse } from 'next/server'
import { obtenerCicloEscolarActual } from '@/lib/ciclosEscolaresService'
import {
  generarPdfComprobanteInscripcion,
  type PagoInscripcionComprobante,
} from '@/lib/comprobanteInscripcionPdf'
import { formaIngresoPorDefecto } from '@/lib/alumnoFormaIngreso'
import { listarPagosColegiaturaAlumno } from '@/lib/pagoColegiaturaService'
import {
  normalizarConceptoNo,
  parsearReferenciaPago,
} from '@/lib/pagoReferenciaColegiatura'
import { validarAlumnoPortal } from '@/lib/portalApiAlumnoAuth'
import { calcularReinscripcionDiferido } from '@/lib/portalReinscripcionService'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

function pagosInscripcion(
  pagos: Awaited<ReturnType<typeof listarPagosColegiaturaAlumno>>,
  ciclo: number
): PagoInscripcionComprobante[] {
  const conceptos = new Set(['11', '12', '13'])
  const out: PagoInscripcionComprobante[] = []

  for (const p of pagos) {
    if (p.pago_cancelado === 1 || p.pago_cancelado === 2) continue
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) continue
    const c = normalizarConceptoNo(parsed.conceptoNo)
    if (!conceptos.has(c)) continue
    if (parsed.cicloEscolar !== ciclo) continue
    out.push({
      referencia: String(p.pago_referencia ?? ''),
      importe: Number(p.pago_importe ?? 0) + Number(p.pago_recargo ?? 0),
      fecha: String(p.pago_fecha ?? '').slice(0, 10),
      formaPago: String(p.pago_forma ?? 'Pago registrado'),
      conceptoNo: c,
    })
  }

  return out
}

export async function GET(request: Request) {
  try {
    const alumnoId = Number(new URL(request.url).searchParams.get('alumnoId'))
    const auth = await validarAlumnoPortal(alumnoId)
    if (!auth.ok) return auth.response

    const ciclo = await obtenerCicloEscolarActual()
    if (!ciclo) {
      return NextResponse.json({ error: 'Ciclo escolar no configurado' }, { status: 503 })
    }

    const alumno = auth.alumno
    const esReinscrito = formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso) === 0
    let cicloComprobante = ciclo.valor

    if (esReinscrito) {
      const supabase = createSupabaseAdmin()
      const calc = await calcularReinscripcionDiferido(supabase, alumno)
      if (calc) cicloComprobante = calc.cicloReinscripcion
    } else {
      cicloComprobante = Number(alumno.alumno_ciclo_escolar) || ciclo.valor
    }

    const pagos = await listarPagosColegiaturaAlumno(alumno.alumno_id, ciclo.valor)
    const filtrados = pagosInscripcion(pagos, cicloComprobante)

    const nombre = `${alumno.alumno_nombre ?? ''} ${alumno.alumno_app ?? ''} ${alumno.alumno_apm ?? ''}`.trim()
    const pdf = generarPdfComprobanteInscripcion({
      nombreAlumno: nombre,
      alumnoRef: Number(alumno.alumno_ref),
      nivel: Number(alumno.alumno_nivel),
      grado: Number(alumno.alumno_grado),
      cicloEscolar: cicloComprobante,
      pagos: filtrados,
    })

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="comprobante-inscripcion-${alumno.alumno_ref}.pdf"`,
      },
    })
  } catch (e) {
    console.error('portal-inscripciones/comprobante:', e)
    return NextResponse.json({ error: 'Error al generar comprobante' }, { status: 500 })
  }
}
