/**
 * Ciclo calendario para autorización / firma de beca.
 * Misma regla que becas-renovacion (a partir del 10 de julio).
 * Ej. 22→23, 23→24…; nunca hardcodear un ciclo permanente.
 */
export function cicloFirmaBecaActual(now = new Date()): number {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const startYear =
    month > 7 || (month === 7 && day >= 10) ? year : year - 1
  return startYear - 2003
}

/** Ciclo de becas a renovar = calendario − 1. */
export function cicloBecaARenovarFirma(now = new Date()): number {
  return cicloFirmaBecaActual(now) - 1
}

export function etiquetaCicloFirmaBeca(ciclo?: number, now = new Date()): string {
  const c = ciclo ?? cicloFirmaBecaActual(now)
  const start = 2003 + c
  return `${start} - ${start + 1}`
}
