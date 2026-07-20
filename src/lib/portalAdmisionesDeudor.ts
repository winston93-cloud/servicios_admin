import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from './alumnoDatosService'
import { formaIngresoPorDefecto } from './alumnoFormaIngreso'
import { alumnoTieneBecaCompletaActiva } from './alumnoBecaService'
import type { PagoDetalleRegistro } from './pagoColegiaturaService'
import { cicloCierreValor } from './portalCierreCicloAnterior'
import { alumnoTienePagoSemiref } from './portalAdmisionesColegiatura'

/**
 * Fallback de adeudos para reinscritos (material feb / junio).
 * Usa el ciclo de cierre (`cicloInscripcionDesdeTemporada(es_actual) - 1`).
 */
export async function esDeudorReinscrito(
  supabase: AppDatabaseClient,
  alumno: AlumnoRegistro,
  pagos: PagoDetalleRegistro[],
  cicloTemporadaActual: number
): Promise<boolean> {
  if (formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso) !== 0) return false

  const cicloCierre = cicloCierreValor(cicloTemporadaActual)
  if (await alumnoTieneBecaCompletaActiva(supabase, alumno.alumno_id, cicloCierre)) {
    return false
  }

  const mes = new Date().getMonth() + 1
  const ref = alumno.alumno_ref

  if (mes === 2 && cicloCierre !== 17) {
    const materialFeb = alumnoTienePagoSemiref(pagos, ref, '16', cicloCierre)
    if (!materialFeb) return true
  }

  if (mes > 5) {
    const junioPagado = alumnoTienePagoSemiref(pagos, ref, '10', cicloCierre)
    if (!junioPagado) return true
  }

  return false
}
