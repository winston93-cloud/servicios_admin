import type { PagoDetalleRegistro } from './pagoColegiaturaService'
import { normalizarConceptoNo, parsearReferenciaPago } from './pagoReferenciaColegiatura'

function pagoVigente(p: PagoDetalleRegistro): boolean {
  return p.pago_cancelado !== 1 && p.pago_cancelado !== 2
}

/**
 * ¿Hay pago vigente del concepto en el ciclo?
 * Los `pagos` ya vienen filtrados por `alumno_id`: se compara concepto + ciclo
 * (igual que la matriz del portal). No exigir dígitos de ref en la referencia —
 * en legacies a veces no coinciden y el alumno veía “Pagado” en la matriz
 * pero el cierre seguía exigiendo liquidar.
 */
export function alumnoTienePagoSemiref(
  pagos: PagoDetalleRegistro[],
  _alumnoRef: string | number,
  conceptoNo: string,
  cicloEscolar: number
): boolean {
  const concepto = normalizarConceptoNo(conceptoNo)

  return pagos.some((p) => {
    if (!pagoVigente(p)) return false
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) return false
    return (
      normalizarConceptoNo(parsed.conceptoNo) === concepto &&
      parsed.cicloEscolar === cicloEscolar
    )
  })
}

export type TipoColegiaturaRequerida = 'febrero' | 'junio' | 'julio'

/**
 * Port de admisiones_pago_colegiatura_requerido (prorroga_inscripcion.php).
 * Valida colegiaturas Feb/Jun/Jul del ciclo en curso para abrir el portal.
 */
export function colegiaturaRequeridaCubierta(
  pagos: PagoDetalleRegistro[],
  alumnoRef: string | number,
  tipo: TipoColegiaturaRequerida,
  cen: number
): { ok: boolean; mensaje: string } {
  const cicloColegiatura = cen - 1

  if (tipo === 'febrero') {
    const ok =
      alumnoTienePagoSemiref(pagos, alumnoRef, '06', cen) ||
      alumnoTienePagoSemiref(pagos, alumnoRef, '06', cen - 1)
    return {
      ok,
      mensaje: 'Recuerde tener todos sus pagos cubiertos hasta el mes de Febrero.',
    }
  }

  if (tipo === 'junio') {
    const ok = alumnoTienePagoSemiref(pagos, alumnoRef, '10', cicloColegiatura)
    return {
      ok,
      mensaje: 'Recuerde tener todos sus pagos cubiertos hasta el mes de Junio.',
    }
  }

  const ok = alumnoTienePagoSemiref(pagos, alumnoRef, '26', cicloColegiatura)
  return {
    ok,
    mensaje: 'Recuerde tener todos sus pagos cubiertos hasta el mes de Julio.',
  }
}
