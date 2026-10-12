/**
 * 2026-10-12 — Resumen de la Beca SEP de un alumno para el módulo Becas (función pura, sin BD).
 * Dice si la SEP está activa o revertida y a qué beca del colegio renunció la familia al aceptarla.
 */
import { CICLO_INICIO_COBRO_SEP } from './cobroSep'

export type FilaBecaSepResumen = {
  ciclo_valor: number
  estatus: string | null
  origen: string | null
  porcentaje_sep: number | string | null
  porcentaje_beca_actual: number | string | null
  monto_mensual: number | string | null
  meses_restantes: number | null
  plan_meses: number | null
  saldo_favor: number | string | null
  anio_completo: boolean | null
  fecha_otorgamiento: string | null
  aprobado_en: string | null
  aprobado_por: string | null
  desglose: {
    folio?: string | null
    prueba?: boolean | null
    becaSustituida?: { clase?: string | null; porcentaje?: number | null } | null
    reversion?: {
      estado?: string | null
      motivo?: string | null
      solicitadaPor?: string | null
      resueltaPor?: string | null
      resueltaEn?: string | null
      calculo?: { mensual?: number | null } | null
    } | null
  } | null
}

export type EstadoBecaSep = 'activa' | 'revertida' | 'reversion_pendiente' | 'suspendida' | 'cancelada'

export type ResumenBecaSep = {
  ciclo: number
  estado: EstadoBecaSep
  porcentajeSep: number
  montoMensual: number | null
  mesesRestantes: number | null
  planMeses: number | null
  saldoFavor: number
  anioCompleto: boolean
  otorgadaEn: string | null
  aprobadoPor: string | null
  folio: string | null
  prueba: boolean
  /** true = el baucher cobra lo registrado aquí (2026-27 en adelante, módulo Beca SEP). */
  cobroAutomatico: boolean
  /** Beca del colegio a la que renunció al aceptar la SEP; null = no tenía. */
  becaRenunciada: { clase: string | null; porcentaje: number } | null
  reversion: {
    motivo: string | null
    solicitadaPor: string | null
    resueltaPor: string | null
    resueltaEn: string | null
    mensual: number | null
  } | null
}

const num = (v: unknown): number | null => {
  const n = Number(v)
  return v == null || v === '' || !Number.isFinite(n) ? null : n
}

export function resumenBecaSep(fila: FilaBecaSepResumen | null | undefined): ResumenBecaSep | null {
  if (!fila) return null
  const d = fila.desglose ?? {}
  const rev = d.reversion ?? null
  const estatus = String(fila.estatus ?? '')
  const estado: EstadoBecaSep =
    estatus === 'cancelada' && rev?.estado === 'autorizada'
      ? 'revertida'
      : estatus === 'activa' && rev?.estado === 'solicitada'
        ? 'reversion_pendiente'
        : estatus === 'suspendida' || estatus === 'cancelada'
          ? estatus
          : 'activa'

  const sust = d.becaSustituida
  const pctAnterior = num(sust?.porcentaje) ?? num(fila.porcentaje_beca_actual) ?? 0
  const becaRenunciada = pctAnterior > 0 ? { clase: sust?.clase?.trim() || null, porcentaje: pctAnterior } : null

  return {
    ciclo: fila.ciclo_valor,
    estado,
    porcentajeSep: num(fila.porcentaje_sep) ?? 0,
    montoMensual: num(fila.monto_mensual),
    mesesRestantes: fila.meses_restantes ?? null,
    planMeses: fila.plan_meses ?? null,
    saldoFavor: num(fila.saldo_favor) ?? 0,
    anioCompleto: Boolean(fila.anio_completo),
    otorgadaEn: fila.fecha_otorgamiento ?? fila.aprobado_en ?? null,
    aprobadoPor: fila.aprobado_por ?? null,
    folio: d.folio ?? null,
    prueba: Boolean(d.prueba),
    cobroAutomatico:
      String(fila.origen ?? '').startsWith('becas_renovacion') && fila.ciclo_valor >= CICLO_INICIO_COBRO_SEP,
    becaRenunciada,
    reversion: rev
      ? {
          motivo: rev.motivo ?? null,
          solicitadaPor: rev.solicitadaPor ?? null,
          resueltaPor: rev.resueltaPor ?? null,
          resueltaEn: rev.resueltaEn ?? null,
          mensual: num(rev.calculo?.mensual),
        }
      : null,
  }
}
