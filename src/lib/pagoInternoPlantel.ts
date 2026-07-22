import { ALUMNO_REF_EXTERNO } from '@/lib/alumnoBusquedaServicios'

/**
 * Series de folio de pagos internos (sistema nuevo):
 * - Winston (primaria/secundaria): desde 26550
 * - Educativo (maternal/kinder): desde 2849, en el hueco libre antes del legacy (~3480)
 */
export type PlantelPagosInternos = 'winston' | 'educativo'

export const PAGO_INTERNO_FOLIO_WINSTON_INICIAL = 26550
export const PAGO_INTERNO_FOLIO_EDUCATIVO_INICIAL = 2849
/** Exclusivo: a partir de aquí hay folios legacy que no son la serie nueva educativa. */
export const PAGO_INTERNO_FOLIO_EDUCATIVO_TECHO = 3480

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
 * Juanita (caja Winston): ve ambos planteles; Externo usa serie Winston.
 * Karla (caja Educativo): solo Educativo; Externo usa serie Educativo.
 * Resto del personal admin: ambos (Externo → Winston).
 */
export function accesoPagosInternosUsuario(
  username: string | null | undefined
): AccesoPagosInternosUsuario {
  const u = (username ?? '').trim().toLowerCase()
  if (u === 'karla') {
    return { plantelesVisibles: ['educativo'], plantelExterno: 'educativo' }
  }
  if (u === 'juanita') {
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
  if (f >= PAGO_INTERNO_FOLIO_WINSTON_INICIAL) return 'winston'
  if (f >= PAGO_INTERNO_FOLIO_EDUCATIVO_INICIAL && f < PAGO_INTERNO_FOLIO_EDUCATIVO_TECHO) {
    return 'educativo'
  }
  return null
}

export function folioInicialPlantel(plantel: PlantelPagosInternos): number {
  return plantel === 'educativo'
    ? PAGO_INTERNO_FOLIO_EDUCATIVO_INICIAL
    : PAGO_INTERNO_FOLIO_WINSTON_INICIAL
}

/**
 * Serie de folio al cobrar: Externo según cuenta; alumno regular según nivel.
 */
export function resolverPlantelFolioPagoInterno(opts: {
  alumnoRef: string | number | null | undefined
  alumnoNivel: number | null | undefined
  usuarioUsername: string | null | undefined
}): PlantelPagosInternos {
  const ref = String(opts.alumnoRef ?? '').trim()
  if (ref === ALUMNO_REF_EXTERNO || ref.toLowerCase() === 'externo') {
    return accesoPagosInternosUsuario(opts.usuarioUsername).plantelExterno
  }
  return plantelPagoDesdeNivel(Number(opts.alumnoNivel) || 0)
}
