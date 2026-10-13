/**
 * 2026-08-20 - Saldo a favor por recargo de Cuota de Inicio (concepto 00)
 * cobrado antes de ampliar el límite al 24 de agosto.
 *
 * Regla operativa (aviso Sistemas):
 * - Quien pagó la cuota 00 con recargo ($50 o $75 u otro monto en `pago_recargo`)
 *   recibe ese monto como crédito.
 * - Se resta UNA sola vez en la siguiente colegiatura pendiente del mismo ciclo
 *   (01…10 / 26; o 30 si tiene pago anual pendiente).
 * - El “crédito” es en la práctica un descuento del recargo ya cobrado en la 00
 *   (no es un producto financiero). Se aplica sobre el importe ya calculado
 *   (lista − beca − otros ajustes / corrección manual). No toca el recargo de
 *   atraso de esa colegiatura.
 * - Becas y otras variantes pueden autorizarse después (p. ej. antes del 10-sep):
 *   el cálculo es dinámico; no se congela el monto. Cuando exista beca,
 *   `calcularImporteConcepto` baja la base y este descuento sigue encima.
 * - Al pagar ese concepto destino, el descuento queda consumido (ya no hay
 *   “siguiente pendiente” con el mismo saldo).
 *
 * 2026-10-13 - Corrección: el descuento se repetía cada mes (al pagar el destino
 * pasaba a la siguiente colegiatura) y también se daba a quien pagó la 00 tarde
 * (después del 24-ago, recargo legítimo). Ahora solo cuenta la 00 del ciclo 23
 * pagada con recargo hasta el 24-ago, y se consume con la primera colegiatura
 * pagada desde que existe la regla (21-ago).
 */
import type { AppDatabaseClient } from '@/lib/dbTypes'
import { CONCEPTO_CUOTA_INICIO } from '@/lib/colegiaturaPrecioReglas'
import {
  normalizarConceptoNo,
  parsearReferenciaPago,
} from '@/lib/pagoReferenciaColegiatura'
import { pagoVigente } from '@/lib/reportes/pagoReporteHelpers'

/** Colegiaturas mensuales + pago anual (no cuota 00 ni material 16). */
export const CONCEPTOS_DESTINO_CREDITO_RECARGO_00 = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '26',
  '30',
] as const

/** Único ciclo con la ampliación del límite de la cuota 00 al 24-ago. */
export const CICLO_CREDITO_RECARGO_00 = 23
/** Cuotas 00 pagadas con recargo después de esta fecha no generan saldo a favor. */
export const FECHA_LIMITE_PAGO_00_CON_CREDITO = '2026-08-24'
/** Colegiaturas pagadas desde esta fecha ya recibieron el descuento (regla en producción). */
export const FECHA_INICIO_CREDITO_RECARGO_00 = '2026-08-21'

function fechaIsoPago(fecha: string | null | undefined): string {
  return String(fecha ?? '').slice(0, 10)
}

export type PagoParaCredito = {
  pago_referencia: string | null
  pago_cancelado?: number | null
  pago_recargo?: number | null
  pago_importe?: number | null
  pago_fecha?: string | null
}

function conceptosDestinoOrdenados(planMeses: number): string[] {
  const out = CONCEPTOS_DESTINO_CREDITO_RECARGO_00.filter((c) => {
    if (c === '26') return planMeses === 2
    return true
  })
  return [...out]
}

/**
 * Monto de recargo vigente cobrado en la cuota 00 del ciclo.
 * Si hubo varios pagos, conserva el de mayor recargo (caso real: un solo pago).
 */
export function montoCreditoRecargoCuotaInicioDesdePagos(
  pagos: PagoParaCredito[],
  cicloEscolar: number
): number {
  if (cicloEscolar !== CICLO_CREDITO_RECARGO_00) return 0
  let mejor = 0
  for (const p of pagos) {
    if (!pagoVigente(p.pago_cancelado ?? null)) continue
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) continue
    if (parsed.cicloEscolar !== cicloEscolar) continue
    if (normalizarConceptoNo(parsed.conceptoNo) !== CONCEPTO_CUOTA_INICIO) {
      continue
    }
    const fecha = fechaIsoPago(p.pago_fecha)
    if (!fecha || fecha > FECHA_LIMITE_PAGO_00_CON_CREDITO) continue
    const recargo = Number(p.pago_recargo ?? 0)
    if (!Number.isFinite(recargo) || recargo <= 0) continue
    if (recargo > mejor) mejor = recargo
  }
  return Math.round(mejor * 100) / 100
}

/** ¿Ya está pagado el concepto (vigente) en este ciclo? */
export function conceptoPagadoEnCiclo(
  pagos: PagoParaCredito[],
  conceptoNo: string,
  cicloEscolar: number
): boolean {
  const c = normalizarConceptoNo(conceptoNo)
  for (const p of pagos) {
    if (!pagoVigente(p.pago_cancelado ?? null)) continue
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) continue
    if (parsed.cicloEscolar !== cicloEscolar) continue
    if (normalizarConceptoNo(parsed.conceptoNo) === c) return true
  }
  return false
}

/** ¿Ya se pagó alguna colegiatura / pago anual con el descuento vigente? */
export function creditoRecargoCuotaInicioConsumido(
  pagos: PagoParaCredito[],
  cicloEscolar: number
): boolean {
  const destinos = new Set<string>(CONCEPTOS_DESTINO_CREDITO_RECARGO_00)
  for (const p of pagos) {
    if (!pagoVigente(p.pago_cancelado ?? null)) continue
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) continue
    if (parsed.cicloEscolar !== cicloEscolar) continue
    if (!destinos.has(normalizarConceptoNo(parsed.conceptoNo))) continue
    if (fechaIsoPago(p.pago_fecha) >= FECHA_INICIO_CREDITO_RECARGO_00) return true
  }
  return false
}

/**
 * Primera colegiatura / pago anual pendiente donde aplicar el crédito.
 * Null si no hay destino (todo liquidado o sin crédito aplicable).
 */
export function conceptoDestinoCreditoRecargoCuotaInicio(
  pagos: PagoParaCredito[],
  cicloEscolar: number,
  planMeses: number
): string | null {
  if (montoCreditoRecargoCuotaInicioDesdePagos(pagos, cicloEscolar) <= 0) {
    return null
  }
  if (creditoRecargoCuotaInicioConsumido(pagos, cicloEscolar)) return null
  for (const c of conceptosDestinoOrdenados(planMeses)) {
    if (!conceptoPagadoEnCiclo(pagos, c, cicloEscolar)) return c
  }
  return null
}

/** Resta el crédito al importe base (nunca negativo). */
export function aplicarCreditoRecargoAImporte(
  importe: number,
  credito: number
): { importe: number; creditoAplicado: number } {
  const base = Number.isFinite(importe) ? Math.max(0, importe) : 0
  const cred = Number.isFinite(credito) ? Math.max(0, credito) : 0
  const aplicado = Math.min(base, cred)
  return {
    importe: Math.round((base - aplicado) * 100) / 100,
    creditoAplicado: Math.round(aplicado * 100) / 100,
  }
}

/**
 * Consulta pagos del alumno y resuelve crédito + concepto destino.
 * Una sola lectura a `pago_detalle` (concepto vía referencia).
 */
export async function resolverCreditoRecargoCuotaInicio(
  db: AppDatabaseClient,
  opts: {
    alumnoId: number
    cicloEscolar: number
    planMeses: number
    /** Si ya traes pagos del ciclo, evita otra query. */
    pagos?: PagoParaCredito[]
  }
): Promise<{
  credito: number
  conceptoDestino: string | null
}> {
  const ciclo = Number(opts.cicloEscolar)
  const alumnoId = Number(opts.alumnoId)
  if (!(ciclo > 0) || !(alumnoId > 0)) {
    return { credito: 0, conceptoDestino: null }
  }

  let pagos = opts.pagos
  if (!pagos) {
    const { data, error } = await db
      .from('pago_detalle')
      .select('pago_referencia, pago_cancelado, pago_recargo, pago_importe, pago_fecha')
      .eq('alumno_id', alumnoId)

    if (error) {
      console.error('creditoRecargoCuotaInicio pagos:', error.message)
      return { credito: 0, conceptoDestino: null }
    }
    pagos = (data ?? []) as PagoParaCredito[]
  }

  const credito = montoCreditoRecargoCuotaInicioDesdePagos(pagos, ciclo)
  if (credito <= 0) return { credito: 0, conceptoDestino: null }

  const conceptoDestino = conceptoDestinoCreditoRecargoCuotaInicio(
    pagos,
    ciclo,
    opts.planMeses === 2 ? 2 : 1
  )
  return { credito, conceptoDestino }
}
