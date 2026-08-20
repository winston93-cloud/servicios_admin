import { ALUMNO_REF_EXTERNO } from '@/lib/alumnoBusquedaServicios'

/**
 * Series de folio de pagos internos — 4 variantes independientes:
 *
 * | Plantel    | Tipo serie     | Rango (aprox.)                         |
 * |------------|----------------|----------------------------------------|
 * | Winston    | cuota_padres   | 2140 … 2848                            |
 * | Winston    | general        | 2671 … (talón actual; no legacy 4xxx+) |
 * | Educativo  | cuota_padres   | 1037 … 2139                            |
 * | Educativo  | general        | 2849 … 3479                            |
 *
 * Cuota de padres y el resto de conceptos NUNCA comparten numeración.
 * Winston y Educativo tampoco: el siguiente folio se calcula filtrando
 * por nivel del alumno (maternal/kinder → Educativo; resto → Winston).
 *
 * El talón anterior Winston (26550+) y legacy combo/otros (~4000–7xxx)
 * no alimentan el autoincremento del talón actual.
 */
export type PlantelPagosInternos = 'winston' | 'educativo'

/** Serie de numeración: general (manuales y demás) vs cuota de padres. */
export type TipoSerieFolioPagoInterno = 'general' | 'cuota_padres'

/** Winston general — talón actual (cambio de talonario). */
export const PAGO_INTERNO_FOLIO_WINSTON_INICIAL = 2671
/**
 * Winston general — inicio del talón anterior (histórico 5 dígitos).
 * El siguiente folio del talón actual no debe “saltar” a este rango.
 */
export const PAGO_INTERNO_FOLIO_WINSTON_TALON_ANTERIOR = 26550
/**
 * Exclusivo: folios legacy (combo/otros ~4xxx–7xxx) fuera del talón actual.
 * Si se incluyen en el máximo, el siguiente folio salta (p. ej. 7322).
 */
export const PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN = 4000
/**
 * Techo práctico de búsqueda del talón Winston actual al calcular el siguiente
 * folio (evita bloques legacy densos 39xx dentro de &lt; 4000).
 */
export const PAGO_INTERNO_FOLIO_WINSTON_ZONA_TALON = 3200

export const PAGO_INTERNO_FOLIO_EDUCATIVO_INICIAL = 2849
/** Exclusivo: a partir de aquí hay folios legacy que no son la serie nueva educativa. */
export const PAGO_INTERNO_FOLIO_EDUCATIVO_TECHO = 3480

/** Cuota de padres — Winston (primaria/secundaria). */
export const PAGO_INTERNO_FOLIO_CUOTA_WINSTON_INICIAL = 2140
/**
 * Exclusivo: techo = inicio serie general Educativo.
 * Así la cuota Winston no “salta” al histórico legacy (~6000+) ni choca con Educativo.
 */
export const PAGO_INTERNO_FOLIO_CUOTA_WINSTON_TECHO = PAGO_INTERNO_FOLIO_EDUCATIVO_INICIAL

/** Cuota de padres — Educativo (maternal/kinder). */
export const PAGO_INTERNO_FOLIO_CUOTA_EDUCATIVO_INICIAL = 1037
/** Exclusivo: choca con el inicio de la serie cuota Winston. */
export const PAGO_INTERNO_FOLIO_CUOTA_EDUCATIVO_TECHO = PAGO_INTERNO_FOLIO_CUOTA_WINSTON_INICIAL

/** @deprecated Usar PAGO_INTERNO_FOLIO_WINSTON_INICIAL */
export const PAGO_INTERNO_FOLIO_INICIAL = PAGO_INTERNO_FOLIO_WINSTON_INICIAL

export const ETIQUETA_PLANTEL_PAGOS_INTERNOS: Record<PlantelPagosInternos, string> = {
  winston: 'Winston',
  educativo: 'Educativo',
}

export type AccesoPagosInternosUsuario = {
  plantelesVisibles: PlantelPagosInternos[]
  plantelExterno: PlantelPagosInternos
}

/**
 * Cuentas que ven Winston + Educativo en listado/Excel.
 * Externo en esas cuentas usa serie Winston.
 * Karla: solo Educativo (Externo → Educativo).
 * Resto del personal: ambos (Externo → Winston).
 */
const USUARIOS_AMBOS_PLANTELES = new Set(['juanita', 'laura', 'mario'])

export function accesoPagosInternosUsuario(
  username: string | null | undefined
): AccesoPagosInternosUsuario {
  const u = (username ?? '').trim().toLowerCase()
  if (u === 'karla') {
    return { plantelesVisibles: ['educativo'], plantelExterno: 'educativo' }
  }
  if (USUARIOS_AMBOS_PLANTELES.has(u)) {
    return { plantelesVisibles: ['winston', 'educativo'], plantelExterno: 'winston' }
  }
  return { plantelesVisibles: ['winston', 'educativo'], plantelExterno: 'winston' }
}

/** Maternal/Kinder → Educativo; Primaria/Secundaria → Winston. */
export function plantelPagoDesdeNivel(nivel: number): PlantelPagosInternos {
  const n = Number(nivel) || 0
  return n === 1 || n === 2 ? 'educativo' : 'winston'
}

/**
 * ¿El pago cuenta para la serie de folio del plantel?
 * Externo (11404): Juanita/Laura cobran en Winston aunque el alumno tenga
 * nivel maternal/kinder; si no se cuenta, el siguiente folio Winston se
 * duplica (p. ej. 2880 EXTERNO + 2880 MENDEZ).
 * Al cancelar/recorrer, usar la misma regla (ver resolverSerieDePago).
 */
export function pagoPerteneceAPlantelSerie(opts: {
  plantel: PlantelPagosInternos
  alumnoNivel: number | null | undefined
  alumnoRef?: string | number | null
}): boolean {
  const ref = String(opts.alumnoRef ?? '').trim()
  const esExterno = ref === ALUMNO_REF_EXTERNO || ref.toLowerCase() === 'externo'
  if (esExterno) {
    if (opts.plantel === 'winston') return true
    return plantelPagoDesdeNivel(Number(opts.alumnoNivel) || 0) === 'educativo'
  }
  if (opts.alumnoNivel == null || !Number.isFinite(Number(opts.alumnoNivel))) {
    return false
  }
  return plantelPagoDesdeNivel(Number(opts.alumnoNivel)) === opts.plantel
}

export function plantelSerieDesdeFolio(folio: number): PlantelPagosInternos | null {
  const f = Number(folio)
  if (!Number.isFinite(f)) return null
  // Talón anterior Winston general (26550+)
  if (f >= PAGO_INTERNO_FOLIO_WINSTON_TALON_ANTERIOR) return 'winston'
  // Serie general Educativo (prioridad en 2849–3479; Winston que continúe
  // ahí se distingue por nivel del alumno en listado/cancelación).
  if (f >= PAGO_INTERNO_FOLIO_EDUCATIVO_INICIAL && f < PAGO_INTERNO_FOLIO_EDUCATIVO_TECHO) {
    return 'educativo'
  }
  // Winston general talón actual (2671 … antes de Educativo)
  if (
    f >= PAGO_INTERNO_FOLIO_WINSTON_INICIAL &&
    f < PAGO_INTERNO_FOLIO_EDUCATIVO_INICIAL
  ) {
    return 'winston'
  }
  // Serie cuota Winston (2140 … 2849)
  if (f >= PAGO_INTERNO_FOLIO_CUOTA_WINSTON_INICIAL && f < PAGO_INTERNO_FOLIO_CUOTA_WINSTON_TECHO) {
    return 'winston'
  }
  // Serie cuota Educativo
  if (
    f >= PAGO_INTERNO_FOLIO_CUOTA_EDUCATIVO_INICIAL &&
    f < PAGO_INTERNO_FOLIO_CUOTA_EDUCATIVO_TECHO
  ) {
    return 'educativo'
  }
  return null
}

export function folioInicialPlantel(
  plantel: PlantelPagosInternos,
  tipoSerie: TipoSerieFolioPagoInterno = 'general'
): number {
  if (tipoSerie === 'cuota_padres') {
    return plantel === 'educativo'
      ? PAGO_INTERNO_FOLIO_CUOTA_EDUCATIVO_INICIAL
      : PAGO_INTERNO_FOLIO_CUOTA_WINSTON_INICIAL
  }
  return plantel === 'educativo'
    ? PAGO_INTERNO_FOLIO_EDUCATIVO_INICIAL
    : PAGO_INTERNO_FOLIO_WINSTON_INICIAL
}

export function folioTechoPlantel(
  plantel: PlantelPagosInternos,
  tipoSerie: TipoSerieFolioPagoInterno = 'general'
): number | null {
  if (tipoSerie === 'cuota_padres') {
    return plantel === 'educativo'
      ? PAGO_INTERNO_FOLIO_CUOTA_EDUCATIVO_TECHO
      : PAGO_INTERNO_FOLIO_CUOTA_WINSTON_TECHO
  }
  if (plantel === 'educativo') return PAGO_INTERNO_FOLIO_EDUCATIVO_TECHO
  // Winston general (talón actual 2671+): no invadir legacy (~4000+)
  // ni el talón anterior (26550+). Techos altos metían 5xxx/7xxx en el máximo.
  return PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN
}

/**
 * Cuentas que, al cobrar, siempre usan serie Winston
 * (aunque el alumno sea maternal/kinder / Educativo).
 */
const USUARIOS_FOLIO_SIEMPRE_WINSTON = new Set(['juanita', 'laura'])

/**
 * Serie de folio al cobrar:
 * - Laura / Juanita → siempre Winston
 * - Externo → según cuenta (plantelExterno)
 * - Resto → según nivel del alumno (Educativo / Winston)
 */
export function resolverPlantelFolioPagoInterno(opts: {
  alumnoRef: string | number | null | undefined
  alumnoNivel: number | null | undefined
  usuarioUsername: string | null | undefined
}): PlantelPagosInternos {
  const u = (opts.usuarioUsername ?? '').trim().toLowerCase()
  if (USUARIOS_FOLIO_SIEMPRE_WINSTON.has(u)) {
    return 'winston'
  }
  const ref = String(opts.alumnoRef ?? '').trim()
  if (ref === ALUMNO_REF_EXTERNO || ref.toLowerCase() === 'externo') {
    return accesoPagosInternosUsuario(opts.usuarioUsername).plantelExterno
  }
  return plantelPagoDesdeNivel(Number(opts.alumnoNivel) || 0)
}
