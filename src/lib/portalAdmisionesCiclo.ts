/** Utilidades de fecha para ventanas del portal (sin lógica de ciclo escolar por calendario). */

export function hoyIso(): string {
  return new Date().toISOString().slice(0, 10)
}
