import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from './alumnoDatosService'
import type { PagoDetalleRegistro } from './pagoColegiaturaService'
import { alumnoTienePagoSemiref } from './portalAdmisionesColegiatura'

/** Port de admisiones_solicitud_capturada + alumno_registro. */
export async function solicitudCapturada(
  supabase: AppDatabaseClient,
  alumno: AlumnoRegistro
): Promise<boolean> {
  if (alumno.alumno_registro) return true

  const { count, error } = await supabase
    .from('alumno_detalles')
    .select('alumno_id', { count: 'exact', head: true })
    .eq('alumno_id', alumno.alumno_id)
    .not('alumno_curp', 'is', null)
    .neq('alumno_curp', '')

  if (error) return false
  return (count ?? 0) > 0
}

/** Port de admisiones_tiene_inscripcion_completa_pagada. */
export function inscripcionCompletaPagada(
  pagos: PagoDetalleRegistro[],
  alumnoRef: string | number,
  cen: number
): boolean {
  if (alumnoTienePagoSemiref(pagos, alumnoRef, '13', cen)) return true
  return (
    alumnoTienePagoSemiref(pagos, alumnoRef, '11', cen) &&
    alumnoTienePagoSemiref(pagos, alumnoRef, '12', cen)
  )
}

export function tieneDiferido1Pagado(
  pagos: PagoDetalleRegistro[],
  alumnoRef: string | number,
  cen: number
): boolean {
  return alumnoTienePagoSemiref(pagos, alumnoRef, '11', cen)
}
