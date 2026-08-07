/**
 * Faltantes de Colegiatura Septiembre (01) ciclo 23 cobrados con monto SEP del ciclo 22.
 * Se suman a Octubre (02) a partir del 1 de octubre 2026.
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

/** Ciclo y concepto donde se recupera el faltante. */
export const FALTANTE_CICLO = 23
export const FALTANTE_CONCEPTO_APLICAR = '02'
/** ISO date (México): no sumar antes de octubre. */
export const FALTANTE_APLICAR_DESDE = '2026-10-01'

function hoyIsoMexico(fecha?: Date): string {
  const d = fecha ?? new Date()
  // en-CA → YYYY-MM-DD; America/Mexico_City evita corrimiento UTC.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * Monto extra a sumar al concepto (0 si no aplica).
 * Solo octubre ciclo 23, desde 2026-10-01, para los 2 refs afectados.
 */
export function faltanteColegiaturaPendiente(opts: {
  alumnoRef: string | number
  conceptoNo: string | number
  cicloEscolar: number
  fecha?: Date
}): number {
  if (Number(opts.cicloEscolar) !== FALTANTE_CICLO) return 0
  if (normalizarConceptoNo(opts.conceptoNo) !== FALTANTE_CONCEPTO_APLICAR) return 0
  if (hoyIsoMexico(opts.fecha) < FALTANTE_APLICAR_DESDE) return 0

  const ref = Number(opts.alumnoRef)
  if (!Number.isFinite(ref)) return 0
  const row = FALTANTES_COLEG_SEP_CICLO23.find((f) => f.alumnoRef === ref)
  return row?.faltante ?? 0
}
