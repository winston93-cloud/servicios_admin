import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { obtenerCicloEscolarActual } from '@/lib/ciclosEscolaresService'
import {
  cicloInscripcionDesdeTemporada,
  cicloFichaAlumnosParaInscripcion,
} from '@/lib/ciclosEscolares'

export const runtime = 'nodejs'

/** GET — diagnóstico ciclos + muestra de alumnos activos Primaria. BORRAR TRAS USO. */
export async function GET() {
  const cicloSistema = await obtenerCicloEscolarActual()
  const cea = Number(cicloSistema?.valor ?? 0)
  const cen = cicloInscripcionDesdeTemporada(cea)
  const cicloFicha = cicloFichaAlumnosParaInscripcion(cen, cea)

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_ciclo_escolar, alumno_nuevo_ingreso, alumno_status, alumno_nivel')
    .eq('alumno_status', 1)
    .eq('alumno_nivel', 3)
    .limit(10)

  // Conteo por ciclo+nuevo_ingreso para nivel 3
  const { data: dist } = await supabase
    .from('alumno')
    .select('alumno_ciclo_escolar, alumno_nuevo_ingreso')
    .eq('alumno_status', 1)
    .eq('alumno_nivel', 3)
    .limit(2000)

  const conteo: Record<string, number> = {}
  for (const r of dist ?? []) {
    const k = `ciclo=${r.alumno_ciclo_escolar} ni=${r.alumno_nuevo_ingreso}`
    conteo[k] = (conteo[k] ?? 0) + 1
  }

  return NextResponse.json({
    cea,
    cen,
    cicloFicha,
    cicloSistema: cicloSistema ? { valor: cicloSistema.valor, nombre: cicloSistema.nombre } : null,
    muestra: data,
    error_muestra: error?.message ?? null,
    distribucion_nivel3: conteo,
  })
}
