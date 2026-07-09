import type { PagoDetalleRegistro } from './pagoColegiaturaService'
import {
  formatearAlumnoRefParaReferencia,
  normalizarConceptoNo,
  parsearReferenciaPago,
} from './pagoReferenciaColegiatura'

function pagoVigente(p: PagoDetalleRegistro): boolean {
  return p.pago_cancelado !== 1 && p.pago_cancelado !== 2
}

export function alumnoTienePagoSemiref(
  pagos: PagoDetalleRegistro[],
  alumnoRef: string | number,
  conceptoNo: string,
  cicloEscolar: number
): boolean {
  const ref5 = formatearAlumnoRefParaReferencia(String(alumnoRef).replace(/\D/g, '').slice(-5))
  const concepto = normalizarConceptoNo(conceptoNo)

  return pagos.some((p) => {
    if (!pagoVigente(p)) return false
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) return false
    return (
      parsed.alumnoRef === ref5 &&
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
