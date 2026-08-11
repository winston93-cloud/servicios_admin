import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  conceptoBoucherAusente,
  normalizarConceptoNo,
  parseImporteBoucher,
} from '@/lib/boucherCore'
import { calcularBoucher } from '@/lib/boucherService'
import { obtenerAlumnoPorId } from '@/lib/alumnoDatosService'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const alumnoId = Number(body.alumnoId)
    const cicloEscolar = Number(body.cicloEscolar)
    const importeManual =
      body.importe != null && body.importe !== ''
        ? parseImporteBoucher(body.importe)
        : null

    if (!alumnoId || !cicloEscolar) {
      return NextResponse.json({ error: 'Alumno y ciclo escolar son obligatorios' }, { status: 400 })
    }

    if (conceptoBoucherAusente(body.conceptoNo)) {
      return NextResponse.json({ ok: true, importe: 0, referencia: '' })
    }

    const conceptoNo = normalizarConceptoNo(body.conceptoNo)

    const supabase = createSupabaseAdmin()
    const alumno = await obtenerAlumnoPorId(alumnoId)
    if (!alumno) {
      return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 })
    }

    const resultado = await calcularBoucher(supabase, {
      alumnoId,
      alumnoRef: alumno.alumno_ref,
      alumnoNivel: alumno.alumno_nivel,
      alumnoGrado: Number(alumno.alumno_grado) || 0,
      conceptoNo,
      cicloEscolar,
      importeManual,
      planMeses: alumno.mes === 2 ? 2 : 1,
      alumnoNuevoIngreso: alumno.alumno_nuevo_ingreso,
      alumnoAlta: alumno.alumno_alta ?? null,
    })

    return NextResponse.json({ ok: true, ...resultado })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al calcular baucher'
    console.error('bauchers/calcular:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
