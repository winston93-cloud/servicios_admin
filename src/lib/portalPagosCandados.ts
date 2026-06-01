import { normalizarConceptoNo } from './pagoReferenciaColegiatura'
import type { FilaMatrizPortal } from './portalPagosMatrizService'

/** Bloque principal: 00 → meses → enero (05+16 juntos) → resto → julio si 11 meses. */
export function slotsColegiaturaPortal(planMeses: number): string[][] {
  const slots: string[][] = [
    ['00'],
    ['01'],
    ['02'],
    ['03'],
    ['04'],
    ['05', '16'],
    ['06'],
    ['07'],
    ['08'],
    ['09'],
    ['10'],
  ]
  if (planMeses === 2) slots.push(['26'])
  return slots
}

/** Cambridge / Winston USA: un concepto por paso. */
export function slotsLineales(conceptos: readonly string[]): string[][] {
  return conceptos.map((c) => [normalizarConceptoNo(c)])
}

/**
 * Muestra todos los pagos hechos desde el inicio y, como pendientes, solo el primer
 * bloque no completado (p. ej. 05 y 16 a la vez en enero).
 */
export function filtrarFilasPorCandado(
  filas: FilaMatrizPortal[],
  slots: string[][]
): FilaMatrizPortal[] {
  const porConcepto = new Map<string, FilaMatrizPortal>()
  for (const f of filas) {
    porConcepto.set(normalizarConceptoNo(f.conceptoNo), f)
  }

  const visibles: FilaMatrizPortal[] = []

  for (const slot of slots) {
    const filasSlot = slot
      .map((c) => porConcepto.get(normalizarConceptoNo(c)))
      .filter((f): f is FilaMatrizPortal => f != null)

    if (filasSlot.length === 0) continue

    const slotCompleto = filasSlot.every((f) => f.pagado)

    for (const f of filasSlot) {
      visibles.push(f)
    }

    if (!slotCompleto) {
      break
    }
  }

  return visibles
}
