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
import {
  guardarPlanMesesCiclo,
  guardarPlanMesesCicloSiAusente,
  obtenerPlanMesesCiclo,
  type PlanMeses,
} from '@/lib/portalPlanMesesCiclo'
import { marcarPortalInscripcionProgreso } from '@/lib/portalInscripcionProgreso'

export type ResultadoPlanPagos =
  | {
      ok: true
      planMeses: PlanMeses
      planEtiqueta: string
      /** Ya había pagos de colegiatura del ciclo; no se pudo cambiar el plan. */
      bloqueadoPorPagos: boolean
      cambiado: boolean
      /** True si solo se guardó plan del ciclo nuevo y no se tocó alumno.mes. */
      mesFichaConservado?: boolean
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

/**
 * Confirma / cambia plan 10 u 11 para un ciclo concreto.
 * El plan es independiente por ciclo: al elegir el del ciclo nuevo no se
 * reescribe el del ciclo a cerrar (`alumno.mes` de la ficha).
 */
export async function actualizarPlanMesesPortal(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  planMesesRaw: number,
  cicloColegiaturasValor: number
): Promise<ResultadoPlanPagos> {
  const planMeses = planMesesNormalizado(planMesesRaw)
  const planFicha = planMesesNormalizado(alumno.mes)
  const planGuardadoCiclo = await obtenerPlanMesesCiclo(
    db,
    alumno.alumno_id,
    cicloColegiaturasValor
  )
  const actual = planGuardadoCiclo ?? planFicha
  const etiqueta = etiquetaPlanMeses(planMeses) ?? `Pago a ${planMeses === 2 ? 11 : 10} meses`
  const fichaCiclo = Number(alumno.alumno_ciclo_escolar) || 0
  const planParaCicloFuturo = fichaCiclo > 0 && cicloColegiaturasValor > fichaCiclo

  const cerrarProgresoVistaInscripcion = async () => {
    await marcarPortalInscripcionProgreso(
      db,
      alumno.alumno_id,
      cicloColegiaturasValor,
      {
        plan_confirmado: true,
        reglamento_visto: true,
        recibo_final_visto: true,
      }
    )
  }

  const tienePagos = await alumnoTienePagosColegiaturaCiclo(alumno, cicloColegiaturasValor)
  if (tienePagos) {
    if (planMeses !== actual) {
      return {
        ok: false,
        error:
          'Ya hay pagos de colegiatura en este ciclo; el plan no se puede cambiar. Conservamos el plan actual.',
      }
    }
    try {
      await guardarPlanMesesCiclo(db, alumno.alumno_id, cicloColegiaturasValor, actual)
      if (planParaCicloFuturo) {
        await guardarPlanMesesCicloSiAusente(db, alumno.alumno_id, fichaCiclo, planFicha)
      }
    } catch {
      /* degradar si la tabla no existe aún */
    }
    await cerrarProgresoVistaInscripcion()
    return {
      ok: true,
      planMeses: actual,
      planEtiqueta: etiquetaPlanMeses(actual) ?? etiqueta,
      bloqueadoPorPagos: true,
      cambiado: false,
      mesFichaConservado: planParaCicloFuturo,
    }
  }

  // Ciclo nuevo (ficha aún en el anterior): congelar plan de la ficha solo
  // si todavía refleja el ciclo a cerrar (p. ej. pasan de 10 → 11).
  if (planParaCicloFuturo && planMeses !== planFicha) {
    await guardarPlanMesesCicloSiAusente(db, alumno.alumno_id, fichaCiclo, planFicha)
  }

  // Mismo ciclo de la ficha y cambian plan: congelar el anterior en ciclo-1.
  if (!planParaCicloFuturo && planMeses !== planFicha) {
    await guardarPlanMesesCicloSiAusente(
      db,
      alumno.alumno_id,
      Math.max(1, cicloColegiaturasValor - 1),
      planFicha
    )
  }

  const planCicloGuardado = await guardarPlanMesesCiclo(
    db,
    alumno.alumno_id,
    cicloColegiaturasValor,
    planMeses
  )

  if (planParaCicloFuturo && planCicloGuardado) {
    // Ficha sigue en el ciclo anterior: alumno.mes = plan de ese ciclo.
    await cerrarProgresoVistaInscripcion()
    return {
      ok: true,
      planMeses,
      planEtiqueta: etiqueta,
      bloqueadoPorPagos: false,
      cambiado: planMeses !== actual,
      mesFichaConservado: true,
    }
  }

  if (planMeses === planFicha && (planCicloGuardado || planParaCicloFuturo)) {
    await cerrarProgresoVistaInscripcion()
    return {
      ok: true,
      planMeses,
      planEtiqueta: etiqueta,
      bloqueadoPorPagos: false,
      cambiado: planMeses !== actual,
      mesFichaConservado: Boolean(planParaCicloFuturo && planCicloGuardado),
    }
  }

  // Escribe alumno.mes: mismo ciclo de ficha, o degradación si aún no hay tabla por ciclo.
  if (planMeses !== planFicha) {
    const { error } = await db
      .from('alumno')
      .update({ mes: planMeses })
      .eq('alumno_id', alumno.alumno_id)

    if (error) {
      console.error('actualizarPlanMesesPortal:', error)
      return { ok: false, error: error.message || 'No se pudo guardar el plan de pagos.' }
    }
  }

  await cerrarProgresoVistaInscripcion()
  return {
    ok: true,
    planMeses,
    planEtiqueta: etiqueta,
    bloqueadoPorPagos: false,
    cambiado: planMeses !== actual,
    mesFichaConservado: false,
  }
}
