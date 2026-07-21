/** Confirmación local del plan 10/11 antes de armar colegiaturas del ciclo nuevo. */

const PREFIX = 'portal_inscripciones_plan_confirmado_v3'

/**
 * Generación de reset por alumno+ciclo (soporte / pruebas).
 * Al subir el número, la confirmación anterior en localStorage deja de contar
 * y el portal vuelve a pedir elegir plan (sin tocar pagos ni `alumno.mes`).
 */
const PLAN_CONFIRMACION_RESET_GEN: Record<string, number> = {
  // 21752 Solano Soto — reset prueba 20-jul-2026 (antes confirmó 10 meses)
  '2375_23': 1,
}

export function clavePlanPagosConfirmado(alumnoId: number, cicloValor: number): string {
  const gen = PLAN_CONFIRMACION_RESET_GEN[`${alumnoId}_${cicloValor}`] ?? 0
  const sufijo = gen > 0 ? `_r${gen}` : ''
  return `${PREFIX}${sufijo}_${alumnoId}_${cicloValor}`
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

export function limpiarPlanPagosConfirmado(alumnoId: number, cicloValor: number): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(clavePlanPagosConfirmado(alumnoId, cicloValor))
  } catch {
    /* ignore */
  }
}

export function planMesesNormalizado(mes: number | null | undefined): 1 | 2 {
  return Number(mes) === 2 ? 2 : 1
}
