import type { AlumnoRegistro } from './alumnoDatosService'
import { normalizarConceptoNo, parsearReferenciaPago } from './pagoReferenciaColegiatura'
import { proyectarReinscripcionAlumno } from './portalReinscripcionProyeccion'

/** Diferidos e inscripción/reinscripción completa (legacy admisiones). */
export function esConceptoInscripcionReinscripcion(conceptoNo: string): boolean {
  const c = normalizarConceptoNo(conceptoNo)
  return c === '11' || c === '12' || c === '13'
}

type AlumnoNivelCobro = Pick<
  AlumnoRegistro,
  'alumno_ciclo_escolar' | 'alumno_nivel' | 'alumno_grado'
>

/**
 * Nivel de plantel para Banorte CE, OpenPay SPEI y CFDI.
 *
 * En conceptos 11/12/13 usa el nivel destino de reinscripción
 * (ej. Kinder 3 → Primaria Winston), según proyección por ciclo de temporada.
 * La regla es permanente: aplica cada año (22→23, 23→24, …) mientras la ficha
 * aún no haya avanzado de ciclo.
 *
 * Colegiaturas y demás conceptos: nivel de ficha.
 */
export function nivelCobroElectronico(
  alumno: AlumnoNivelCobro,
  conceptoNo: string,
  cicloTemporadaActual?: number
): number {
  const nivelFicha = Number(alumno.alumno_nivel) || 0
  if (!esConceptoInscripcionReinscripcion(conceptoNo)) {
    return nivelFicha
  }
  if (cicloTemporadaActual == null || !Number.isFinite(cicloTemporadaActual)) {
    return nivelFicha
  }
  return proyectarReinscripcionAlumno(alumno, cicloTemporadaActual).nivel || nivelFicha
}

/** Concepto en posiciones 6–7 de la referencia de 12 dígitos. */
export function nivelCobroDesdeReferencia(
  alumno: AlumnoNivelCobro,
  referencia: string,
  cicloTemporadaActual?: number
): number {
  const digits = String(referencia ?? '').replace(/\D/g, '')
  const concepto = digits.length >= 7 ? digits.slice(5, 7) : ''
  let temporada = cicloTemporadaActual
  if (
    (temporada == null || !Number.isFinite(temporada)) &&
    esConceptoInscripcionReinscripcion(concepto)
  ) {
    const parsed = parsearReferenciaPago(referencia)
    if (parsed?.cicloEscolar != null && parsed.cicloEscolar > 0) {
      temporada = parsed.cicloEscolar - 1
    }
  }
  return nivelCobroElectronico(alumno, concepto, temporada)
}
