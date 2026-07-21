import type { PagoDetalleRegistro } from './pagoColegiaturaService'
import { alumnoTienePagoSemiref } from './portalAdmisionesColegiatura'

/** Conceptos Winston USA / Doble titulación (tercios). */
export const CONCEPTOS_DOBLE_TITULACION = ['23', '24', '25'] as const

/**
 * Adeudo parcial de doble titulación en un ciclo:
 * ya empezó el programa (al menos un pago) y aún le faltan tercios.
 * Así solo aparece a quienes deben (p. ej. los 2 del reporte ciclo 22),
 * no a todo el alumnado ni a quienes ya liquidaron los 3.
 */
export function resumenAdeudoDobleTitulacionCiclo(
  pagos: PagoDetalleRegistro[],
  alumnoRef: string | number,
  cicloValor: number
): {
  tienePrograma: boolean
  liquidado: boolean
  pendientes: string[]
  pagados: string[]
} {
  const pagados: string[] = []
  const pendientes: string[] = []

  for (const c of CONCEPTOS_DOBLE_TITULACION) {
    if (alumnoTienePagoSemiref(pagos, alumnoRef, c, cicloValor)) pagados.push(c)
    else pendientes.push(c)
  }

  const tienePrograma = pagados.length > 0
  const liquidado = pendientes.length === 0

  return { tienePrograma, liquidado, pendientes, pagados }
}

export function debeMostrarAdeudoDobleTitulacionCiclo(
  pagos: PagoDetalleRegistro[],
  alumnoRef: string | number,
  cicloValor: number
): boolean {
  const r = resumenAdeudoDobleTitulacionCiclo(pagos, alumnoRef, cicloValor)
  return r.tienePrograma && !r.liquidado
}
