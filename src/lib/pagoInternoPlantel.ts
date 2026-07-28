import { ALUMNO_REF_EXTERNO } from '@/lib/alumnoBusquedaServicios'

/**
 * Series de folio de pagos internos (sistema nuevo):
 * - Winston general (primaria/secundaria): desde 26550
 * - Educativo general (maternal/kinder): desde 2849, techo 3480
 * - Cuota de padres Winston: desde 2140 hasta antes de la serie general Educativo (2849)
 *   (no reutilizar el histórico legacy de combo ~6000–7000)
 * - Cuota de padres Educativo: desde 1037 hasta antes de la serie cuota Winston (2140)
 */
export type PlantelPagosInternos = 'winston' | 'educativo'

/** Serie de numeración: general (manuales y demás) vs cuota de padres. */
export type TipoSerieFolioPagoInterno = 'general' | 'cuota_padres'

export const PAGO_INTERNO_FOLIO_WINSTON_INICIAL = 26550
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

export function plantelSerieDesdeFolio(folio: number): PlantelPagosInternos | null {
  const f = Number(folio)
  if (!Number.isFinite(f)) return null
  // Serie general Winston
  if (f >= PAGO_INTERNO_FOLIO_WINSTON_INICIAL) return 'winston'
  // Serie general Educativo (hueco; tiene prioridad sobre cuota Winston en ese rango)
  if (f >= PAGO_INTERNO_FOLIO_EDUCATIVO_INICIAL && f < PAGO_INTERNO_FOLIO_EDUCATIVO_TECHO) {
    return 'educativo'
  }
  // Serie cuota Winston (2140 … 26549, excl. hueco educativo ya capturado)
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
  return plantel === 'educativo' ? PAGO_INTERNO_FOLIO_EDUCATIVO_TECHO : null
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
