/**
 * Reglas de colegiatura (portal / baucher):
 * - Beca Winston (alumno_beca: IMSS, Winston, etc.): se pierde después del día 10 del mes del concepto.
 * - Beca SEP (lista fija por alumno_ref): nunca se pierde; solo aplica recargo.
 * - Recargo: $75 por cada mes de atraso (a partir del día 11 del mes del concepto).
 */
import { normalizarConceptoNo } from './pagoReferenciaColegiatura'

export const RECARGO_PESOS_POR_MES = 75

/** Mes calendario del concepto (legacy concepto_mes). */
export const CONCEPTO_MES: Record<string, number> = {
  '00': 8,
  '01': 9,
  '02': 10,
  '03': 11,
  '04': 12,
  '05': 1,
  '16': 1,
  '06': 2,
  '07': 3,
  '08': 4,
  '09': 5,
  '10': 6,
  '26': 7,
}

/** Orden de meses dentro del ciclo escolar (ago → jul). */
const ORDEN_MES_CICLO = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7] as const

function indiceMesCiclo(mes: number): number {
  return ORDEN_MES_CICLO.indexOf(mes as (typeof ORDEN_MES_CICLO)[number])
}

export function mesDeConcepto(conceptoNo: string): number | null {
  const c = normalizarConceptoNo(conceptoNo)
  return CONCEPTO_MES[c] ?? null
}

/**
 * ¿La beca Winston sigue vigente para este concepto en la fecha dada?
 * Conceptos 00 y 16 nunca reciben beca Winston.
 */
export function becaWinstonAplicaEnFecha(
  conceptoNo: string,
  fecha: Date = new Date()
): boolean {
  const c = normalizarConceptoNo(conceptoNo)
  if (c === '00' || c === '16') return false

  const mesConcepto = mesDeConcepto(c)
  if (mesConcepto == null) return true

  const mesActual = fecha.getMonth() + 1
  const dia = fecha.getDate()
  const iC = indiceMesCiclo(mesConcepto)
  const iA = indiceMesCiclo(mesActual)
  if (iC < 0 || iA < 0) return true

  if (iA < iC) return true
  if (iA === iC) return dia <= 10
  return false
}

/**
 * Multiplicador de meses de atraso.
 * Ej.: colegiatura junio el 11-jun → 1; el 11-jul sin pagar → 2.
 */
export function multiplicadorRecargoMeses(
  conceptoNo: string,
  fecha: Date = new Date()
): number {
  const mesConcepto = mesDeConcepto(conceptoNo)
  if (mesConcepto == null) return 0

  const iC = indiceMesCiclo(mesConcepto)
  const iA = indiceMesCiclo(fecha.getMonth() + 1)
  if (iC < 0 || iA < 0 || iA < iC) return 0

  let multiplo = iA - iC
  if (fecha.getDate() > 10) multiplo += 1
  return Math.max(0, multiplo)
}

export function calcularRecargoPesos(
  conceptoNo: string,
  fecha: Date = new Date()
): number {
  return multiplicadorRecargoMeses(conceptoNo, fecha) * RECARGO_PESOS_POR_MES
}

/** Conceptos de colegiatura mensuales donde aplica SEP / recargo de atraso. */
export function conceptoAplicaSepYRecargo(conceptoNo: string): boolean {
  const c = normalizarConceptoNo(conceptoNo)
  if (c === '00' || c === '16') return false
  return mesDeConcepto(c) != null
}
