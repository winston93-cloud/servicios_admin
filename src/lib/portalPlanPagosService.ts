import type { AppDatabaseClient } from '@/lib/dbTypes'
import { etiquetaPlanMeses } from '@/lib/alumnoPlanMeses'
import { slotsColegiaturaPortal } from '@/lib/portalPagosCandados'
import { listarPagosColegiaturaAlumno } from '@/lib/pagoColegiaturaService'
import {
  normalizarConceptoNo,
  parsearReferenciaPago,
} from '@/lib/pagoReferenciaColegiatura'
import { planMesesNormalizado } from '@/lib/portalPlanPagosConfirmado'
import type { AlumnoRegistro } from '@/lib/alumnoDatosService'

export type ResultadoPlanPagos =
  | {
      ok: true
      planMeses: 1 | 2
      planEtiqueta: string
      /** Ya había pagos de colegiatura del ciclo; no se pudo cambiar el plan. */
      bloqueadoPorPagos: boolean
      cambiado: boolean
    }
  | { ok: false; error: string }

/**
 * ¿Ya hay al menos un pago de colegiatura del ciclo nuevo?
 * Si sí, el plan 10/11 no debe cambiarse (afectaría slots ya iniciados).
 * Solo cuenta pagos vigentes de conceptos de colegiatura (00…10 y 26),
 * con importe > 0 — no confunde tip fantasma $0 ni inscripción 11/12/13.
 */
export async function alumnoTienePagosColegiaturaCiclo(
  alumno: AlumnoRegistro,
  cicloValor: number
): Promise<boolean> {
  const pagos = await listarPagosColegiaturaAlumno(alumno.alumno_id, cicloValor)
  const conceptos = new Set(slotsColegiaturaPortal(2).flat().map((c) => normalizarConceptoNo(c)))

  return pagos.some((p) => {
    if (p.pago_cancelado === 1 || p.pago_cancelado === 2) return false
    if (!(Number(p.pago_importe) > 0)) return false
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed || parsed.cicloEscolar !== cicloValor) return false
    return conceptos.has(normalizarConceptoNo(parsed.conceptoNo))
  })
}

export async function actualizarPlanMesesPortal(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  planMesesRaw: number,
  cicloColegiaturasValor: number
): Promise<ResultadoPlanPagos> {
  const planMeses = planMesesNormalizado(planMesesRaw)
  const actual = planMesesNormalizado(alumno.mes)
  const etiqueta = etiquetaPlanMeses(planMeses) ?? `Pago a ${planMeses === 2 ? 11 : 10} meses`

  const tienePagos = await alumnoTienePagosColegiaturaCiclo(alumno, cicloColegiaturasValor)
  if (tienePagos) {
    if (planMeses !== actual) {
      return {
        ok: false,
        error:
          'Ya hay pagos de colegiatura en este ciclo; el plan no se puede cambiar. Conservamos el plan actual.',
      }
    }
    return {
      ok: true,
      planMeses: actual,
      planEtiqueta: etiquetaPlanMeses(actual) ?? etiqueta,
      bloqueadoPorPagos: true,
      cambiado: false,
    }
  }

  if (planMeses === actual) {
    return {
      ok: true,
      planMeses,
      planEtiqueta: etiqueta,
      bloqueadoPorPagos: false,
      cambiado: false,
    }
  }

  const { error } = await db
    .from('alumno')
    .update({ mes: planMeses })
    .eq('alumno_id', alumno.alumno_id)

  if (error) {
    console.error('actualizarPlanMesesPortal:', error)
    return { ok: false, error: error.message || 'No se pudo guardar el plan de pagos.' }
  }

  return {
    ok: true,
    planMeses,
    planEtiqueta: etiqueta,
    bloqueadoPorPagos: false,
    cambiado: true,
  }
}
