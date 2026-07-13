import type { AlumnoRegistro } from './alumnoDatosService'
import { formaIngresoPorDefecto } from './alumnoFormaIngreso'
import type { PagoDetalleRegistro } from './pagoColegiaturaService'
import { cicloInscripcionValor } from './portalAdmisionesCiclo'
import { alumnoTienePagoSemiref } from './portalAdmisionesColegiatura'
import { slotsColegiaturaPortal } from './portalPagosCandados'
import { normalizarConceptoNo } from './pagoReferenciaColegiatura'

/** Ciclo escolar que el reinscrito debe liquidar antes de reinscribirse. */
export function cicloCierreValor(cea?: number): number {
  return cicloInscripcionValor(cea) - 1
}

export function planMesesAlumno(alumno: Pick<AlumnoRegistro, 'mes'>): 1 | 2 {
  return Number(alumno.mes) === 2 ? 2 : 1
}

function etiquetaPlan(planMeses: 1 | 2): string {
  return planMeses === 2 ? 'Plan de pagos: 11 meses' : 'Plan de pagos: 10 meses'
}

/**
 * True si todos los slots de colegiatura del plan (10 u 11 meses) están pagados
 * en el ciclo a cerrar. Mismos slots que el candado del portal de pagos.
 */
export function cicloCierreLiquidado(
  pagosCierre: PagoDetalleRegistro[],
  alumno: Pick<AlumnoRegistro, 'alumno_ref' | 'mes'>,
  cicloValor?: number
): boolean {
  const plan = planMesesAlumno(alumno)
  const slots = slotsColegiaturaPortal(plan)
  const ref = alumno.alumno_ref
  const ciclo = cicloValor ?? cicloCierreValor()

  for (const slot of slots) {
    for (const concepto of slot) {
      if (!alumnoTienePagoSemiref(pagosCierre, ref, normalizarConceptoNo(concepto), ciclo)) {
        return false
      }
    }
  }
  return true
}

export function resumenCierreCicloParaReinscrito(
  alumno: AlumnoRegistro,
  pagosCierre: PagoDetalleRegistro[],
  ciclo: { valor: number; nombre: string }
): {
  requerido: boolean
  liquidado: boolean
  ciclo: { valor: number; nombre: string }
  planEtiqueta: string
} | null {
  if (formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso) !== 0) return null

  const plan = planMesesAlumno(alumno)
  const liquidado = cicloCierreLiquidado(pagosCierre, alumno, ciclo.valor)

  return {
    requerido: !liquidado,
    liquidado,
    ciclo: { valor: ciclo.valor, nombre: ciclo.nombre },
    planEtiqueta: etiquetaPlan(plan),
  }
}
