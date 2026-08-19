/**
 * Reglas de colegiatura (portal / baucher):
 * - Beca Winston (alumno_beca: IMSS, Winston, etc.): se pierde después del día 10 del mes del concepto.
 * - Beca SEP (lista fija por alumno_ref, solo su ciclo de datos p.ej. 22):
 *   nunca se pierde dentro de ese ciclo; solo aplica recargo. No arrastra a 23+.
 * - Recargo: $75 por cada mes de atraso (a partir del día 11 del mes del concepto;
 *   cuota de inicio 00: límite ampliado al 24 de agosto, recargo desde el 25).
 *
 * El mes del concepto vive en un año calendario del ciclo (valor N → ago N+2003 … jul N+2004).
 * Sin ese año, en jul (fin de ciclo en el orden ago→jul) se cobraba “atraso” fantasma
 * a la cuota de agosto del ciclo siguiente (ej. $900 = 12×$75).
 */
import { normalizarConceptoNo } from './pagoReferenciaColegiatura'

export const RECARGO_PESOS_POR_MES = 75

/** Colegiaturas mensuales (01…): sin recargo hasta el día 10 del mes del concepto. */
export const DIA_LIMITE_SIN_RECARGO = 10

/** Cuota de inicio de curso (00): sin recargo hasta el 24 de agosto del ciclo. */
export const DIA_LIMITE_SIN_RECARGO_CUOTA_INICIO = 24

export const CONCEPTO_CUOTA_INICIO = '00'

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

/** Último día del mes del concepto sin recargo (00 = 24 ago; resto = 10). */
export function diaLimiteSinRecargo(conceptoNo: string): number {
  const c = normalizarConceptoNo(conceptoNo)
  return c === CONCEPTO_CUOTA_INICIO
    ? DIA_LIMITE_SIN_RECARGO_CUOTA_INICIO
    : DIA_LIMITE_SIN_RECARGO
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

  const diaLimite = diaLimiteSinRecargo(conceptoNo)

  if (cicloValor != null && cicloValor > 0) {
    const anioC = anioCalendarioConcepto(conceptoNo, cicloValor)
    if (anioC == null) return 0
    const iC = anioC * 12 + mesConcepto
    const iA = fecha.getFullYear() * 12 + (fecha.getMonth() + 1)
    if (iA < iC) return 0
    let multiplo = iA - iC
    if (fecha.getDate() > diaLimite) multiplo += 1
    return Math.max(0, multiplo)
  }

  // Fallback legacy (solo mes): válido si la fecha ya está dentro del mismo ciclo del concepto.
  const iC = indiceMesCiclo(mesConcepto)
  const iA = indiceMesCiclo(fecha.getMonth() + 1)
  if (iC < 0 || iA < 0 || iA < iC) return 0

  let multiplo = iA - iC
  if (fecha.getDate() > diaLimite) multiplo += 1
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
