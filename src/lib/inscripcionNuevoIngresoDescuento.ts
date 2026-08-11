/**
 * Descuento de inscripción para nuevo ingreso (concepto 13).
 * Port de enlinea3/module/core.php (alu_nvo=1):
 * - 35% durante 15 días desde alumno_alta
 * - 20% después de esa ventana
 *
 * No aplica a reinscritos (11/12/13 de diferidos).
 */
import { getDiscount } from './boucherCore'
import { formaIngresoPorDefecto } from './alumnoFormaIngreso'

/** Días de vigencia del 35% (alta + 15, el día 15 ya no entra). */
export const DIAS_PROMO_INSCRIPCION_NI = 15

/** Ciclos desde los que existe la promo 35% (histórico: a partir de 13 = 2016-2017). */
const CICLO_MINIMO_PROMO_35 = 13

export const PCT_INSCRIPCION_NI_15_DIAS = 35
export const PCT_INSCRIPCION_NI_POSTERIOR = 20

function parseIsoLocal(iso: string): Date | null {
  const s = String(iso ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Días que faltan para que cierre la promo 35% (0 = ya no aplica). */
export function diasRestantesPromoInscripcionNi(
  alumnoAlta: string | null | undefined,
  fecha: Date = new Date()
): number {
  const alta = parseIsoLocal(String(alumnoAlta ?? ''))
  if (!alta) return 0
  const limite = new Date(alta.getFullYear(), alta.getMonth(), alta.getDate() + DIAS_PROMO_INSCRIPCION_NI)
  const hoy = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
  return Math.floor((limite.getTime() - hoy.getTime()) / 86_400_000)
}

export function porcentajeDescuentoInscripcionNi(opts: {
  esNuevoIngreso: boolean
  alumnoAlta?: string | null
  cicloAlumno?: number | null
  fecha?: Date
}): number {
  if (!opts.esNuevoIngreso) return 0
  const ciclo = Number(opts.cicloAlumno) || 0
  const dias = diasRestantesPromoInscripcionNi(opts.alumnoAlta, opts.fecha ?? new Date())
  if (dias > 0 && ciclo >= CICLO_MINIMO_PROMO_35) {
    return PCT_INSCRIPCION_NI_15_DIAS
  }
  return PCT_INSCRIPCION_NI_POSTERIOR
}

export function esAlumnoNuevoIngreso(valor: string | number | null | undefined): boolean {
  return formaIngresoPorDefecto(valor) === 1
}

/** Importe de inscripción NI (lista − 35% o 20%). */
export function importeInscripcionNuevoIngreso(
  montoLista: number,
  opts: {
    esNuevoIngreso: boolean
    alumnoAlta?: string | null
    cicloAlumno?: number | null
    fecha?: Date
  }
): number {
  if (!(montoLista > 0) || !opts.esNuevoIngreso) return montoLista
  const pct = porcentajeDescuentoInscripcionNi(opts)
  return Math.round(getDiscount(montoLista, pct) * 100) / 100
}

export function mensajePromoInscripcionNi(opts: {
  esNuevoIngreso: boolean
  alumnoAlta?: string | null
  cicloAlumno?: number | null
  fecha?: Date
}): string | null {
  if (!opts.esNuevoIngreso) return null
  const pct = porcentajeDescuentoInscripcionNi(opts)
  if (pct === PCT_INSCRIPCION_NI_15_DIAS) {
    const dias = diasRestantesPromoInscripcionNi(opts.alumnoAlta, opts.fecha)
    return `Periodo de inscripción abierto, tiene ${dias} días válidos para su descuento de 35% en su pago de inscripción.`
  }
  return 'Periodo de inscripción abierto, tiene un descuento del 20% en su pago de inscripción.'
}
