import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { normalizarConceptoNo, parseImporteBoucher } from '@/lib/boucherCore'
import { calcularBoucher } from '@/lib/boucherService'
import { obtenerAlumnoPorId } from '@/lib/alumnoDatosService'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const alumnoId = Number(body.alumnoId)
    const conceptoRaw = String(body.conceptoNo ?? '0')
    const cicloEscolar = Number(body.cicloEscolar)
    const importeManual =
      body.importe != null && body.importe !== ''
        ? parseImporteBoucher(body.importe)
        : null

    if (!alumnoId || !cicloEscolar) {
      return NextResponse.json({ error: 'Alumno y ciclo escolar son obligatorios' }, { status: 400 })
    }

    const conceptoNo = normalizarConceptoNo(conceptoRaw)
    if (conceptoRaw === '0' || conceptoNo === '00') {
      return NextResponse.json({ ok: true, importe: 0, referencia: '' })
    }

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
    })

    return NextResponse.json({ ok: true, ...resultado })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al calcular baucher'
    console.error('bauchers/calcular:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
