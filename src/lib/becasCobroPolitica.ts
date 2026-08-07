/**
 * Política de becas en cobro (portal / baucher / pago anual).
 *
 * - SEP hardcodeada: solo ciclo de datos 22. Ciclo 23+ no tiene módulo SEP.
 * - Winston ciclo 23+: aplica solo si alumno_beca tiene beca_estatus=1 en ese ciclo
 *   (se activa al pulsar «Autorizar beca» en becas_renovacion).
 */

import { BECAS_SEP_CICLO_DATOS } from './becasSepOpenHouse'

/** ¿Se puede aplicar la lista SEP hardcodeada a este ciclo de cobro? */
export function sepAplicaEnCicloCobro(cicloEscolar: number | null | undefined): boolean {
  const c = Number(cicloEscolar)
  return Number.isFinite(c) && c === BECAS_SEP_CICLO_DATOS
}
