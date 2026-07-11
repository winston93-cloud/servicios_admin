import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from './alumnoDatosService'
import { formaIngresoPorDefecto } from './alumnoFormaIngreso'
import type { PagoDetalleRegistro } from './pagoColegiaturaService'
import { cicloInscripcionValor } from './portalAdmisionesCiclo'
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
 * Port de loader.php ($debtor) para reinscritos.
 * Bloquea el portal si faltan pagos de material (feb) o junio según calendario.
 *
 * Junio se exige del ciclo que se está cerrando (= ciclo de inscripción − 1),
 * no de `cea` de BD: si `es_actual` aún no avanzó pero la fecha de corte ya
 * pasó, `cea - 1` pedía el junio del año anterior (falso adeudo).
 */
export async function esDeudorReinscrito(
  supabase: AppDatabaseClient,
  alumno: AlumnoRegistro,
  pagos: PagoDetalleRegistro[],
  cea: number
): Promise<boolean> {
  if (formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso) !== 0) return false
  if (await tieneBecaCompletaCea(supabase, alumno.alumno_id, cea)) return false

  const mes = new Date().getMonth() + 1
  const ref = alumno.alumno_ref
  const cicloCierre = cicloInscripcionValor() - 1

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
