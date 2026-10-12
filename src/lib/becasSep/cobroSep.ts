/**
 * 2026-10-12 — Cobro automático de Beca SEP (desde el ciclo 23).
 * El módulo Beca SEP de becas_renovacion registra en alumno_beca_sep la mensualidad de cada mes que falta
 * (desglose.esperados) al aplicar, recalcular, ajustar o revertir. El baucher cobra ese monto por concepto
 * y no aplica la beca Winston encima (la SEP la sustituye). Revertida = estatus 'cancelada' con los montos
 * de regreso a la beca del colegio, que también se respetan.
 * El ciclo 22 y anteriores siguen con la lista fija (integracionSep.ts); aquí no se tocan.
 * Interruptor: BECAS_SEP_COBRO=1 para todos; apagado, solo BECAS_SEP_REFS_PRUEBA (por defecto 29905, alumno de prueba).
 */
import type { AppDatabaseClient } from '../dbTypes'

/** Primer ciclo que cobra desde alumno_beca_sep (el 22 es la lista fija heredada). */
export const CICLO_INICIO_COBRO_SEP = 23
const ORIGEN = 'becas_renovacion'
// 2026-10-12 — Se agrega ALAN PRUEBA (29904), segundo alumno de prueba (sin beca previa).
const REFS_PRUEBA_POR_DEFECTO = [29905, 29904]

export type CobroSepPorConcepto = Record<string, number>

export type FilaCobroSep = {
  estatus?: string | null
  origen?: string | null
  desglose?: { esperados?: Record<string, unknown> } | null
}

function refsPrueba(): number[] {
  const crudo = process.env.BECAS_SEP_REFS_PRUEBA?.trim()
  if (!crudo) return REFS_PRUEBA_POR_DEFECTO
  return crudo
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
}

export function cobroSepActivo(alumnoRef: number | string): boolean {
  return process.env.BECAS_SEP_COBRO === '1' || refsPrueba().includes(Number(alumnoRef))
}

const concepto = (c: string) => String(c).replace(/\D/g, '').padStart(2, '0').slice(-2)

/** Montos por concepto que debe cobrar el baucher según la fila; null si no aplica. Función pura. */
export function montosCobroSep(fila: FilaCobroSep | null | undefined): CobroSepPorConcepto | null {
  if (!fila) return null
  if (!String(fila.origen ?? '').startsWith(ORIGEN)) return null
  if (fila.estatus !== 'activa' && fila.estatus !== 'cancelada') return null
  const esperados = fila.desglose?.esperados
  if (!esperados || typeof esperados !== 'object') return null
  const out: CobroSepPorConcepto = {}
  for (const [c, v] of Object.entries(esperados)) {
    const n = Number(v)
    if (Number.isFinite(n) && n >= 0) out[concepto(c)] = Math.round(n * 100) / 100
  }
  return Object.keys(out).length ? out : null
}

/**
 * Carga una vez por alumno y ciclo, antes de calcular los conceptos. Si falla la lectura, devuelve null y el
 * baucher cobra como antes (mejor que bloquear el pago).
 */
export async function cargarCobroSep(
  db: AppDatabaseClient,
  alumnoRef: number | string | null | undefined,
  cicloValor: number | null | undefined
): Promise<CobroSepPorConcepto | null> {
  const ref = Number(alumnoRef)
  const ciclo = Number(cicloValor)
  if (!Number.isFinite(ref) || !Number.isFinite(ciclo) || ciclo < CICLO_INICIO_COBRO_SEP) return null
  if (!cobroSepActivo(ref)) return null
  const { data, error } = await db
    .from('alumno_beca_sep')
    .select('estatus, origen, desglose')
    .eq('alumno_ref', ref)
    .eq('ciclo_valor', ciclo)
    .maybeSingle()
  if (error) {
    console.warn('cargarCobroSep:', error.message)
    return null
  }
  return montosCobroSep(data as FilaCobroSep | null)
}
