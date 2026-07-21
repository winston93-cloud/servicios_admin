import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from '@/lib/alumnoDatosService'
import type { PagoDetalleRegistro } from '@/lib/pagoColegiaturaService'
import { planMesesNormalizado } from '@/lib/portalPlanPagosConfirmado'
import { alumnoTienePagoSemiref } from '@/lib/portalAdmisionesColegiatura'

/** 1 = 10 meses, 2 = 11 meses (concepto julio = 26). */
export type PlanMeses = 1 | 2

export async function obtenerPlanMesesCiclo(
  db: AppDatabaseClient,
  alumnoId: number,
  cicloValor: number
): Promise<PlanMeses | null> {
  const { data, error } = await db
    .from('alumno_plan_meses')
    .select('mes')
    .eq('alumno_id', alumnoId)
    .eq('ciclo_valor', cicloValor)
    .maybeSingle()

  if (error) {
    // Tabla aún no migrada: degradar sin tumbar el portal.
    console.warn('obtenerPlanMesesCiclo:', error.message)
    return null
  }
  if (!data) return null
  return planMesesNormalizado(data.mes)
}

export async function guardarPlanMesesCiclo(
  db: AppDatabaseClient,
  alumnoId: number,
  cicloValor: number,
  planMeses: PlanMeses
): Promise<boolean> {
  const { error } = await db.from('alumno_plan_meses').upsert(
    {
      alumno_id: alumnoId,
      ciclo_valor: cicloValor,
      mes: planMeses,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: 'alumno_id,ciclo_valor' }
  )

  if (error) {
    console.warn('guardarPlanMesesCiclo:', error.message)
    return false
  }
  return true
}

/** Guarda solo si no hay fila (congela el plan histórico del ciclo). */
export async function guardarPlanMesesCicloSiAusente(
  db: AppDatabaseClient,
  alumnoId: number,
  cicloValor: number,
  planMeses: PlanMeses
): Promise<void> {
  const actual = await obtenerPlanMesesCiclo(db, alumnoId, cicloValor)
  if (actual != null) return
  await guardarPlanMesesCiclo(db, alumnoId, cicloValor, planMeses)
}

/**
 * Plan aplicable a un ciclo concreto.
 *
 * - Con fila en `alumno_plan_meses` → esa.
 * - Ciclo pasado / de cierre (menor que la ficha o con pagos de cierre):
 *   no heredar `alumno.mes` del ciclo nuevo; julio (26) solo si ya hay pago
 *   o quedó congelado el plan 11 de ese ciclo.
 * - Ciclo de la ficha o futuro → `alumno.mes` (legacy) si no hay fila.
 */
export async function resolverPlanMesesParaCiclo(
  db: AppDatabaseClient,
  alumno: Pick<AlumnoRegistro, 'alumno_id' | 'alumno_ref' | 'alumno_ciclo_escolar' | 'mes'>,
  cicloValor: number,
  pagosCiclo?: PagoDetalleRegistro[]
): Promise<PlanMeses> {
  const stored = await obtenerPlanMesesCiclo(db, alumno.alumno_id, cicloValor)
  if (stored != null) return stored

  const ficha = Number(alumno.alumno_ciclo_escolar) || 0
  const planFicha = planMesesNormalizado(alumno.mes)

  // Ciclo estrictamente anterior a la ficha (= cierre típico tras avance).
  if (ficha > 0 && cicloValor < ficha) {
    if (
      pagosCiclo &&
      alumnoTienePagoSemiref(pagosCiclo, alumno.alumno_ref, '26', cicloValor)
    ) {
      return 2
    }
    return 1
  }

  return planFicha
}

/**
 * Plan del ciclo de cierre (reinscripción).
 * Nunca hereda `alumno.mes` del ciclo nuevo: julio (26) solo si quedó
 * congelado el plan 11 de ese ciclo o ya hay pago de julio.
 */
export async function resolverPlanMesesCierre(
  db: AppDatabaseClient,
  alumno: Pick<AlumnoRegistro, 'alumno_id' | 'alumno_ref' | 'alumno_ciclo_escolar' | 'mes'>,
  cicloCierre: number,
  pagosCierre: PagoDetalleRegistro[]
): Promise<PlanMeses> {
  const stored = await obtenerPlanMesesCiclo(db, alumno.alumno_id, cicloCierre)
  if (stored != null) return stored

  if (alumnoTienePagoSemiref(pagosCierre, alumno.alumno_ref, '26', cicloCierre)) {
    return 2
  }

  return 1
}
