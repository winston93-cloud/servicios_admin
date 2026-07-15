/** Confirmación local del plan 10/11 antes de armar colegiaturas del ciclo nuevo. */

const PREFIX = 'portal_inscripciones_plan_confirmado'

export function clavePlanPagosConfirmado(alumnoId: number, cicloValor: number): string {
  return `${PREFIX}_${alumnoId}_${cicloValor}`
}

export function leerPlanPagosConfirmado(alumnoId: number, cicloValor: number): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(clavePlanPagosConfirmado(alumnoId, cicloValor)) === '1'
  } catch {
    return false
  }
}

export function marcarPlanPagosConfirmado(alumnoId: number, cicloValor: number): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(clavePlanPagosConfirmado(alumnoId, cicloValor), '1')
  } catch {
    /* ignore quota / private mode */
  }
}

export function planMesesNormalizado(mes: number | null | undefined): 1 | 2 {
  return Number(mes) === 2 ? 2 : 1
}
