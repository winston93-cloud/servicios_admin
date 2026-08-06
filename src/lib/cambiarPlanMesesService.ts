import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from '@/lib/alumnoDatosService'
import { etiquetaPlanMeses } from '@/lib/alumnoPlanMeses'
import { listarPagosColegiaturaAlumno } from '@/lib/pagoColegiaturaService'
import {
  normalizarConceptoNo,
  parsearReferenciaPago,
} from '@/lib/pagoReferenciaColegiatura'
import { planMesesNormalizado } from '@/lib/portalPlanPagosConfirmado'
import {
  guardarPlanMesesCiclo,
  obtenerPlanMesesCiclo,
  resolverPlanMesesParaCiclo,
  type PlanMeses,
} from '@/lib/portalPlanMesesCiclo'

/** Concepto colegiatura septiembre en la referencia (dígitos 6–7). */
export const CONCEPTO_COLEGIATURA_SEPTIEMBRE = '01'

export type EstadoCambiarPlan = {
  alumnoId: number
  alumnoRef: string
  nombre: string
  cicloValor: number
  planMeses: PlanMeses
  planEtiqueta: string
  /** True si ya hay pago vigente de colegiatura septiembre del ciclo. */
  bloqueadoPorSeptiembre: boolean
  puedeCambiar: boolean
}

export type ResultadoCambiarPlan =
  | {
      ok: true
      planMeses: PlanMeses
      planEtiqueta: string
      cambiado: boolean
      bloqueadoPorSeptiembre: boolean
    }
  | { ok: false; error: string }

function nombreAlumno(a: Pick<AlumnoRegistro, 'alumno_nombre' | 'alumno_app' | 'alumno_apm'>): string {
  return [a.alumno_nombre, a.alumno_app, a.alumno_apm].filter(Boolean).join(' ').trim()
}

/**
 * ¿Ya pagó colegiatura de septiembre (01) del ciclo?
 * Solo pagos vigentes con importe > 0.
 */
export async function alumnoTieneColegiaturaSeptiembrePagada(
  alumno: Pick<AlumnoRegistro, 'alumno_id' | 'alumno_ref'>,
  cicloValor: number
): Promise<boolean> {
  const pagos = await listarPagosColegiaturaAlumno(alumno.alumno_id, cicloValor)
  return pagos.some((p) => {
    if (p.pago_cancelado === 1 || p.pago_cancelado === 2) return false
    if (!(Number(p.pago_importe) > 0)) return false
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed || parsed.cicloEscolar !== cicloValor) return false
    return normalizarConceptoNo(parsed.conceptoNo) === CONCEPTO_COLEGIATURA_SEPTIEMBRE
  })
}

export async function consultarEstadoCambiarPlan(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  cicloValor: number
): Promise<EstadoCambiarPlan> {
  const pagos = await listarPagosColegiaturaAlumno(alumno.alumno_id, cicloValor)
  const planMeses = await resolverPlanMesesParaCiclo(db, alumno, cicloValor, pagos)
  const bloqueadoPorSeptiembre = await alumnoTieneColegiaturaSeptiembrePagada(alumno, cicloValor)

  return {
    alumnoId: alumno.alumno_id,
    alumnoRef: String(alumno.alumno_ref),
    nombre: nombreAlumno(alumno),
    cicloValor,
    planMeses,
    planEtiqueta: etiquetaPlanMeses(planMeses) ?? `Pago a ${planMeses === 2 ? 11 : 10} meses`,
    bloqueadoPorSeptiembre,
    puedeCambiar: !bloqueadoPorSeptiembre,
  }
}

/**
 * Cambia plan 10 ↔ 11 meses en ficha (`alumno.mes`) y en `alumno_plan_meses`.
 * Solo si no hay colegiatura de septiembre pagada del ciclo.
 */
export async function cambiarPlanMesesAdmin(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  cicloValor: number,
  planMesesRaw: number
): Promise<ResultadoCambiarPlan> {
  const planMeses = planMesesNormalizado(planMesesRaw)
  const pagos = await listarPagosColegiaturaAlumno(alumno.alumno_id, cicloValor)
  const actual = await resolverPlanMesesParaCiclo(db, alumno, cicloValor, pagos)
  const etiqueta =
    etiquetaPlanMeses(planMeses) ?? `Pago a ${planMeses === 2 ? 11 : 10} meses`

  const bloqueadoPorSeptiembre = await alumnoTieneColegiaturaSeptiembrePagada(alumno, cicloValor)
  if (bloqueadoPorSeptiembre) {
    if (planMeses !== actual) {
      return {
        ok: false,
        error:
          'Ya hay colegiatura de septiembre pagada en este ciclo; el plan no se puede cambiar.',
      }
    }
    return {
      ok: true,
      planMeses: actual,
      planEtiqueta: etiquetaPlanMeses(actual) ?? etiqueta,
      cambiado: false,
      bloqueadoPorSeptiembre: true,
    }
  }

  if (planMeses === actual) {
    const planCiclo = await obtenerPlanMesesCiclo(db, alumno.alumno_id, cicloValor)
    if (planCiclo == null) {
      await guardarPlanMesesCiclo(db, alumno.alumno_id, cicloValor, planMeses)
    }
    return {
      ok: true,
      planMeses,
      planEtiqueta: etiqueta,
      cambiado: false,
      bloqueadoPorSeptiembre: false,
    }
  }

  const guardado = await guardarPlanMesesCiclo(db, alumno.alumno_id, cicloValor, planMeses)
  if (!guardado) {
    // Degradar: al menos actualizar ficha si la tabla por ciclo falla.
    console.warn('cambiarPlanMesesAdmin: no se pudo upsert alumno_plan_meses')
  }

  if (planMeses !== planMesesNormalizado(alumno.mes)) {
    const { error } = await db
      .from('alumno')
      .update({ mes: planMeses })
      .eq('alumno_id', alumno.alumno_id)

    if (error) {
      console.error('cambiarPlanMesesAdmin:', error)
      return { ok: false, error: error.message || 'No se pudo guardar el plan en la ficha.' }
    }
  }

  return {
    ok: true,
    planMeses,
    planEtiqueta: etiqueta,
    cambiado: true,
    bloqueadoPorSeptiembre: false,
  }
}
