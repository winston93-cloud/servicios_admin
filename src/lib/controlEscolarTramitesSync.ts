/**
 * Sincronización CE ↔ pagos internos (solo servidor / DB).
 * Archivo aparte de controlEscolarTramitesService para no arrastrar nodemailer
 * al bundle cliente vía repararFoliosWinstonInsforge → pagoInternoService.
 */
import type { AppDatabaseClient } from '@/lib/dbTypes'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { PAGO_INTERNO_FOLIO_FUERA_TALON_MIN } from '@/lib/pagoInternoPlantel'
import { esConceptoTramiteControlEscolar } from '@/lib/controlEscolarTramitesTipos'

/**
 * Motivo al cancelar un trámite CE por cambios en pagos internos:
 * - `folio_quemado`: cancelar solo — el folio sigue ocupado en el talón (no se reutiliza).
 * - `fuera_talon`: duplicado/sombra movido a 9xxxxx — ya no es folio de caja.
 */
export type MotivoCancelacionTramiteCe = 'folio_quemado' | 'fuera_talon'

export type AccionSyncTramiteCe =
  | 'sin_tramite'
  | 'sin_cambio'
  | 'liberado_intacto'
  | { tipo: 'folio_actualizado'; de: number; a: number }
  | { tipo: 'tramite_cancelado'; motivo: MotivoCancelacionTramiteCe }

export function esFolioPagoInternoEnTalon(folio: number): boolean {
  return Number.isFinite(folio) && folio > 0 && folio < PAGO_INTERNO_FOLIO_FUERA_TALON_MIN
}

export async function cancelarTramitesPorPagoIds(pagoIds: number[]): Promise<void> {
  const ids = [...new Set(pagoIds.filter((id) => Number.isFinite(id) && id > 0))]
  if (!ids.length) return
  const db = createDbAdmin()
  const { error } = await db
    .from('ce_tramite_administrativo')
    .update({ estado: 'cancelado' })
    .in('pago_id', ids)
    .eq('estado', 'pendiente')
  if (error) {
    console.error('cancelarTramitesPorPagoIds:', error)
  }
}

/**
 * Alinea un trámite CE con el estado actual de `pago_interno`.
 * Solo modifica trámites `pendiente`; los `liberado` no se tocan.
 */
export async function sincronizarTramiteConPagoInterno(
  db: AppDatabaseClient,
  pagoId: number
): Promise<AccionSyncTramiteCe> {
  const id = Number(pagoId)
  if (!Number.isFinite(id) || id < 1) return 'sin_tramite'

  const { data: tramite, error: tErr } = await db
    .from('ce_tramite_administrativo')
    .select('id, estado, pago_folio, concepto_id')
    .eq('pago_id', id)
    .maybeSingle()
  if (tErr) {
    console.error('sincronizarTramiteConPagoInterno tramite:', tErr)
    return 'sin_cambio'
  }
  if (!tramite?.id) return 'sin_tramite'
  if (tramite.estado === 'liberado') return 'liberado_intacto'

  const { data: pago, error: pErr } = await db
    .from('pago_interno')
    .select('pago_id, concepto_id, pago_folio, pago_cancelado')
    .eq('pago_id', id)
    .maybeSingle()
  if (pErr) {
    console.error('sincronizarTramiteConPagoInterno pago:', pErr)
    return 'sin_cambio'
  }
  if (!pago) return 'sin_cambio'

  const conceptoId = Number(pago.concepto_id)
  if (!esConceptoTramiteControlEscolar(conceptoId)) {
    if (tramite.estado === 'pendiente') {
      const { error } = await db
        .from('ce_tramite_administrativo')
        .update({ estado: 'cancelado' })
        .eq('id', tramite.id)
        .eq('estado', 'pendiente')
      if (error) console.error('sync CE concepto cambió:', error)
      return { tipo: 'tramite_cancelado', motivo: 'folio_quemado' }
    }
    return 'sin_cambio'
  }

  const folio = Number(pago.pago_folio)
  const cancelado = Number(pago.pago_cancelado) === 1
  const fueraTalon = !esFolioPagoInternoEnTalon(folio)

  if (cancelado || fueraTalon) {
    if (tramite.estado !== 'pendiente') return 'sin_cambio'
    const motivo: MotivoCancelacionTramiteCe = fueraTalon ? 'fuera_talon' : 'folio_quemado'
    const { error } = await db
      .from('ce_tramite_administrativo')
      .update({ estado: 'cancelado' })
      .eq('id', tramite.id)
      .eq('estado', 'pendiente')
    if (error) {
      console.error('sync CE cancelar tramite:', error)
      return 'sin_cambio'
    }
    return { tipo: 'tramite_cancelado', motivo }
  }

  const folioTramite =
    tramite.pago_folio == null || !Number.isFinite(Number(tramite.pago_folio))
      ? null
      : Number(tramite.pago_folio)
  if (folioTramite !== folio) {
    const { error } = await db
      .from('ce_tramite_administrativo')
      .update({ pago_folio: folio })
      .eq('id', tramite.id)
    if (error) {
      console.error('sync CE actualizar folio:', error)
      return 'sin_cambio'
    }
    return { tipo: 'folio_actualizado', de: folioTramite ?? 0, a: folio }
  }

  return 'sin_cambio'
}

export async function sincronizarTramitesPorPagoIds(
  db: AppDatabaseClient,
  pagoIds: number[]
): Promise<{ resultados: Array<{ pagoId: number; accion: AccionSyncTramiteCe }> }> {
  const ids = [...new Set(pagoIds.filter((id) => Number.isFinite(id) && id > 0))]
  const resultados: Array<{ pagoId: number; accion: AccionSyncTramiteCe }> = []
  for (const pagoId of ids) {
    const accion = await sincronizarTramiteConPagoInterno(db, pagoId)
    if (accion !== 'sin_tramite' && accion !== 'sin_cambio') {
      resultados.push({ pagoId, accion })
    }
  }
  return { resultados }
}

/** Reconcilia todos los trámites pendientes con su `pago_interno` (idempotente). */
export async function reconciliarTramitesPendientesConPagos(
  db: AppDatabaseClient = createDbAdmin()
): Promise<{
  revisados: number
  actualizados: number
  cancelados: number
  detalle: string[]
}> {
  const { data, error } = await db
    .from('ce_tramite_administrativo')
    .select('pago_id')
    .eq('estado', 'pendiente')
    .limit(1000)
  if (error) throw new Error(error.message)

  const pagoIds = (data ?? []).map((r) => Number(r.pago_id)).filter((id) => id > 0)
  const { resultados } = await sincronizarTramitesPorPagoIds(db, pagoIds)
  const detalle: string[] = []
  let actualizados = 0
  let cancelados = 0
  for (const r of resultados) {
    if (typeof r.accion === 'object' && r.accion.tipo === 'folio_actualizado') {
      actualizados += 1
      detalle.push(`pago_id=${r.pagoId} folio ${r.accion.de}→${r.accion.a}`)
    } else if (typeof r.accion === 'object' && r.accion.tipo === 'tramite_cancelado') {
      cancelados += 1
      detalle.push(`pago_id=${r.pagoId} trámite cancelado (${r.accion.motivo})`)
    }
  }
  return { revisados: pagoIds.length, actualizados, cancelados, detalle }
}
