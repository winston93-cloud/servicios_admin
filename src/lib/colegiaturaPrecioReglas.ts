/**
 * Reglas de colegiatura (portal / baucher):
 * - Beca Winston (alumno_beca: IMSS, Winston, etc.): se pierde después del día 10 del mes del concepto.
 * - Beca SEP (lista fija por alumno_ref): nunca se pierde; solo aplica recargo.
 * - Recargo: $75 por cada mes de atraso (a partir del día 11 del mes del concepto).
 *
 * El mes del concepto vive en un año calendario del ciclo (valor N → ago N+2003 … jul N+2004).
 * Sin ese año, en jul (fin de ciclo en el orden ago→jul) se cobraba “atraso” fantasma
 * a la cuota de agosto del ciclo siguiente (ej. $900 = 12×$75).
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
  '30': 8,
}

/** Orden de meses dentro del ciclo escolar (ago → jul). */
const ORDEN_MES_CICLO = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7] as const

function indiceMesCiclo(mes: number): number {
  return ORDEN_MES_CICLO.indexOf(mes as (typeof ORDEN_MES_CICLO)[number])
}

/** Año calendario del mes del concepto dentro del ciclo (N → 20xx-20xx+1). */
export function anioCalendarioConcepto(
  conceptoNo: string,
  cicloValor: number
): number | null {
  const mes = mesDeConcepto(conceptoNo)
  if (mes == null || !Number.isFinite(cicloValor) || cicloValor <= 0) return null
  const anioInicio = cicloValor + 2003
  return mes >= 8 ? anioInicio : anioInicio + 1
}

export function mesDeConcepto(conceptoNo: string): number | null {
  const c = normalizarConceptoNo(conceptoNo)
  return CONCEPTO_MES[c] ?? null
}

/**
 * ¿La beca Winston sigue vigente para este concepto en la fecha dada?
 * Conceptos 00 y 16 nunca reciben beca Winston.
 * Con `cicloValor`, compara contra el mes calendario real del ciclo (no solo orden ago→jul).
 */
export function becaWinstonAplicaEnFecha(
  conceptoNo: string,
  fecha: Date = new Date(),
  cicloValor?: number
): boolean {
  const c = normalizarConceptoNo(conceptoNo)
  if (c === '00' || c === '16') return false

  const mesConcepto = mesDeConcepto(c)
  if (mesConcepto == null) return true

  if (cicloValor != null && cicloValor > 0) {
    const anioC = anioCalendarioConcepto(c, cicloValor)
    if (anioC == null) return true
    const iC = anioC * 12 + mesConcepto
    const iA = fecha.getFullYear() * 12 + (fecha.getMonth() + 1)
    if (iA < iC) return true
    if (iA === iC) return fecha.getDate() <= 10
    return false
  }

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
 * Ej.: colegiatura junio (ciclo) el 11-jun → 1; el 11-jul sin pagar → 2.
 * Requiere `cicloValor` para no confundir jul del ciclo en curso con ago del siguiente.
 */
export function multiplicadorRecargoMeses(
  conceptoNo: string,
  fecha: Date = new Date(),
  cicloValor?: number
): number {
  const mesConcepto = mesDeConcepto(conceptoNo)
  if (mesConcepto == null) return 0

  if (cicloValor != null && cicloValor > 0) {
    const anioC = anioCalendarioConcepto(conceptoNo, cicloValor)
    if (anioC == null) return 0
    const iC = anioC * 12 + mesConcepto
    const iA = fecha.getFullYear() * 12 + (fecha.getMonth() + 1)
    if (iA < iC) return 0
    let multiplo = iA - iC
    if (fecha.getDate() > 10) multiplo += 1
    return Math.max(0, multiplo)
  }

  // Fallback legacy (solo mes): válido si la fecha ya está dentro del mismo ciclo del concepto.
  const iC = indiceMesCiclo(mesConcepto)
  const iA = indiceMesCiclo(fecha.getMonth() + 1)
  if (iC < 0 || iA < 0 || iA < iC) return 0

  let multiplo = iA - iC
  if (fecha.getDate() > 10) multiplo += 1
  return Math.max(0, multiplo)
}

export function calcularRecargoPesos(
  conceptoNo: string,
  fecha: Date = new Date(),
  cicloValor?: number
): number {
  return multiplicadorRecargoMeses(conceptoNo, fecha, cicloValor) * RECARGO_PESOS_POR_MES
}

/** Conceptos de colegiatura mensuales donde aplica SEP / recargo de atraso. */
export function conceptoAplicaSepYRecargo(conceptoNo: string): boolean {
  const c = normalizarConceptoNo(conceptoNo)
  if (c === '00' || c === '16' || c === '30') return false
  return mesDeConcepto(c) != null
}
