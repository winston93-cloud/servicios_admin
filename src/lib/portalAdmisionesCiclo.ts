import { cambioCicloMmDd } from './portalAdmisionesConfig'

export function mmddHoy(): string {
  const d = new Date()
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function hoyIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Ciclo escolar actual (cea) — port de admisiones loader.php. */
export function cicloEscolarActualValor(): number {
  const y = new Date().getFullYear()
  return mmddHoy() < cambioCicloMmDd() ? y - 2004 : y - 2003
}

/**
 * Ciclo de inscripción/reinscripción activo (cen).
 * Antes del cambio de ciclo: cen = cea + 1; después: cen = cea.
 */
export function cicloInscripcionValor(cea?: number): number {
  const ceaVal = cea ?? cicloEscolarActualValor()
  return mmddHoy() < cambioCicloMmDd() ? ceaVal + 1 : ceaVal
}
