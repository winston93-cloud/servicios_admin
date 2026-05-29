/** Estructura de pago_referencia (12 dígitos). */
export interface ReferenciaPagoParseada {
  alumnoRef: string
  conceptoNo: string
  cicloEscolar: number
  verificador: string
  valida: boolean
}

export function parsearReferenciaPago(referencia: string | null | undefined): ReferenciaPagoParseada | null {
  const ref = String(referencia ?? '').replace(/\D/g, '')
  if (ref.length !== 12) return null

  const ciclo = parseInt(ref.slice(7, 9), 10)
  return {
    alumnoRef: ref.slice(0, 5),
    conceptoNo: ref.slice(5, 7),
    cicloEscolar: Number.isNaN(ciclo) ? 0 : ciclo,
    verificador: ref.slice(9, 12),
    valida: true,
  }
}

export function referenciaCoincideCiclo(
  referencia: string | null | undefined,
  cicloEscolar: number
): boolean {
  const p = parsearReferenciaPago(referencia)
  if (!p) return false
  return p.cicloEscolar === cicloEscolar
}

/** Dos dígitos del concepto en la referencia (01, 09, 16…). */
export function normalizarConceptoNo(no: string | number | null | undefined): string {
  const s = String(no ?? '').replace(/\D/g, '')
  if (!s) return '00'
  return s.padStart(2, '0').slice(-2)
}

/** Orden ascendente por número de concepto (00, 01, 02 …). */
export function compararConceptoNoAsc(
  a: string | number | null | undefined,
  b: string | number | null | undefined
): number {
  return parseInt(normalizarConceptoNo(a), 10) - parseInt(normalizarConceptoNo(b), 10)
}

export function formatearAlumnoRefParaReferencia(ref: string | number): string {
  const s = String(ref ?? '').replace(/\D/g, '')
  return s.padStart(5, '0').slice(-5)
}
