/**
 * Faltantes de Colegiatura Septiembre (01) ciclo 23 cobrados con monto SEP del ciclo 22.
 * Se suman YA a la Colegiatura Octubre (02) del mismo ciclo (concepto, no fecha).
 *
 * 20669 MELISSA GARCIA OLGUIN — pagó 3734.57; lista sec. 5900 → faltante 2165.43
 * 20963 JULIAN MUJICA LEDEZMA — pagó 3485.71; lista prim. 5470 → faltante 1984.29
 */
import { normalizarConceptoNo } from './pagoReferenciaColegiatura'

export type FaltanteColegiaturaCiclo23 = {
  alumnoRef: number
  nombre: string
  pagadoSep: number
  listaSep: number
  faltante: number
}

export const FALTANTES_COLEG_SEP_CICLO23: readonly FaltanteColegiaturaCiclo23[] = [
  {
    alumnoRef: 20669,
    nombre: 'MELISSA GARCIA OLGUIN',
    pagadoSep: 3734.57,
    listaSep: 5900,
    faltante: 2165.43,
  },
  {
    alumnoRef: 20963,
    nombre: 'JULIAN MUJICA LEDEZMA',
    pagadoSep: 3485.71,
    listaSep: 5470,
    faltante: 1984.29,
  },
] as const

export const FALTANTE_CICLO = 23
/** Concepto octubre: ahí se recupera el faltante de septiembre. */
export const FALTANTE_CONCEPTO_APLICAR = '02'

/**
 * Monto extra a sumar al concepto (0 si no aplica).
 * Octubre ciclo 23 para los 2 refs que pagaron SEP viejo en septiembre.
 */
export function faltanteColegiaturaPendiente(opts: {
  alumnoRef: string | number
  conceptoNo: string | number
  cicloEscolar: number
}): number {
  if (Number(opts.cicloEscolar) !== FALTANTE_CICLO) return 0
  if (normalizarConceptoNo(opts.conceptoNo) !== FALTANTE_CONCEPTO_APLICAR) return 0

  const ref = Number(opts.alumnoRef)
  if (!Number.isFinite(ref)) return 0
  const row = FALTANTES_COLEG_SEP_CICLO23.find((f) => f.alumnoRef === ref)
  return row?.faltante ?? 0
}
