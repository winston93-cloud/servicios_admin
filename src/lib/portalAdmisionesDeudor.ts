import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from './alumnoDatosService'
import { formaIngresoPorDefecto } from './alumnoFormaIngreso'
import type { PagoDetalleRegistro } from './pagoColegiaturaService'
import { cicloCierreValor } from './portalCierreCicloAnterior'
import { alumnoTienePagoSemiref } from './portalAdmisionesColegiatura'

async function tieneBecaCompletaCea(
  supabase: AppDatabaseClient,
  alumnoId: number,
  cea: number
): Promise<boolean> {
  const { count, error } = await supabase
    .from('alumno_beca')
    .select('beca_id', { count: 'exact', head: true })
    .eq('alumno_id', alumnoId)
    .eq('beca_porcentaje', 100)
    .eq('beca_ciclo_escolar', cea)
    .eq('beca_estatus', 1)

  if (error) return false
  return (count ?? 0) > 0
}

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
  if (await tieneBecaCompletaCea(supabase, alumno.alumno_id, cicloTemporadaActual)) {
    return false
  }

  const mes = new Date().getMonth() + 1
  const ref = alumno.alumno_ref
  const cicloCierre = cicloCierreValor(cicloTemporadaActual)

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
