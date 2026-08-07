/**
 * Política de becas en cobro (portal / baucher / pago anual).
 *
 * - SEP hardcodeada: solo ciclo de datos 22 (ver becasSepOpenHouse / integracionSep).
 * - Ciclo 23: de momento NO se aplica ninguna beca (SEP ni Winston) hasta aviso de Mario.
 *   Winston 23 se autorizará desde becas_renovacion («autoriza beca»).
 *   SEP 23 aún no está definida ni construida.
 */

/** A partir de este ciclo el cobro ignora Winston/SEP hasta reactivar. */
export const BECAS_EN_COBRO_SUSPENDIDAS_DESDE_CICLO = 23

export function becasEnCobroSuspendidas(cicloEscolar: number | null | undefined): boolean {
  const c = Number(cicloEscolar)
  return Number.isFinite(c) && c >= BECAS_EN_COBRO_SUSPENDIDAS_DESDE_CICLO
}
