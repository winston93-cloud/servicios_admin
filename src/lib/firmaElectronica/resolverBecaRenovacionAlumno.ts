/**
 * Tipo/porcentaje de beca en renovación: ciclo origen (22→23…) o fila única si ya activó cobro.
 */
import type { AppDatabaseClient } from '@/lib/dbTypes'
import { cicloBecaARenovarFirma } from './cicloFirmaBeca'

export type BecaRenovacionAlumno = {
  beca_id: number | null
  beca_porcentaje: number | null
  beca_ciclo_escolar: number | null
}

export async function resolverBecaRenovacionAlumno(
  db: AppDatabaseClient,
  alumnoId: number
): Promise<BecaRenovacionAlumno> {
  const vacio: BecaRenovacionAlumno = {
    beca_id: null,
    beca_porcentaje: null,
    beca_ciclo_escolar: null,
  }
  const cicloOrigen = cicloBecaARenovarFirma()

  const { data: porCiclo, error: errCiclo } = await db
    .from('alumno_beca')
    .select('beca_id, beca_porcentaje, beca_ciclo_escolar')
    .eq('alumno_id', alumnoId)
    .eq('beca_ciclo_escolar', cicloOrigen)
    .maybeSingle()
  if (errCiclo) throw new Error(errCiclo.message)

  const row =
    porCiclo ??
    (
      await db
        .from('alumno_beca')
        .select('beca_id, beca_porcentaje, beca_ciclo_escolar')
        .eq('alumno_id', alumnoId)
        .maybeSingle()
    ).data

  if (!row) return vacio

  return {
    beca_id: row.beca_id != null ? Number(row.beca_id) : null,
    beca_porcentaje:
      row.beca_porcentaje != null ? Number(row.beca_porcentaje) : null,
    beca_ciclo_escolar:
      row.beca_ciclo_escolar != null ? Number(row.beca_ciclo_escolar) : null,
  }
}
