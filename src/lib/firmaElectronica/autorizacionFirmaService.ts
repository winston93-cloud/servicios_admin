/**
 * Estado de autorización / activación de beca para firma electrónica.
 */
import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AppInsforgeClient } from '@/lib/dbTypes'
import { cicloFirmaBecaActual } from './cicloFirmaBeca'
import type { FlujoFirmaBeca } from './cartaAceptacionPayload'
import {
  BECAS_CARTAS_FIRMADAS_BUCKET,
  claveCartaFirmada,
  subirCartaFirmadaPdf,
} from './cartaFirmadaStorage'

export type AutorizacionFirmaRow = {
  id: string
  alumno_id: number
  ciclo_escolar: number
  flujo: FlujoFirmaBeca
  expediente_id: string
  activo: boolean
  beca_activada: boolean
  beca_activada_en: string | null
  firmado_por: string | null
  carta_firmada_bucket: string | null
  carta_firmada_key: string | null
  carta_firmada_url: string | null
}

const SELECT_AUT =
  'id, alumno_id, ciclo_escolar, flujo, expediente_id, activo, beca_activada, beca_activada_en, firmado_por, carta_firmada_bucket, carta_firmada_key, carta_firmada_url'

export async function obtenerAutorizacionFirmaActiva(
  db: AppDatabaseClient,
  alumnoId: number,
  ciclo = cicloFirmaBecaActual()
): Promise<AutorizacionFirmaRow | null> {
  const { data, error } = await db
    .from('becas_autorizacion_firma')
    .select(SELECT_AUT)
    .eq('alumno_id', alumnoId)
    .eq('ciclo_escolar', ciclo)
    .eq('activo', true)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return data as AutorizacionFirmaRow
}

export async function obtenerAutorizacionFirmaPorExpediente(
  db: AppDatabaseClient,
  opts: { flujo: FlujoFirmaBeca; expedienteId: string; ciclo?: number }
): Promise<AutorizacionFirmaRow | null> {
  const ciclo = opts.ciclo ?? cicloFirmaBecaActual()
  const { data, error } = await db
    .from('becas_autorizacion_firma')
    .select(SELECT_AUT)
    .eq('expediente_id', opts.expedienteId)
    .eq('flujo', opts.flujo)
    .eq('ciclo_escolar', ciclo)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return data as AutorizacionFirmaRow
}

export async function activarBecaConCartaFirmada(opts: {
  db: AppDatabaseClient
  client: AppInsforgeClient
  alumnoId: number
  firmadoPor: string
  pdfBytes: Uint8Array
}): Promise<
  | { ok: true; row: AutorizacionFirmaRow }
  | { ok: false; error: string; status?: number }
> {
  const auth = await obtenerAutorizacionFirmaActiva(opts.db, opts.alumnoId)
  if (!auth) {
    return {
      ok: false,
      error: 'No hay beca autorizada para firma en el ciclo actual.',
      status: 403,
    }
  }

  if (auth.beca_activada && auth.carta_firmada_key) {
    return { ok: true, row: auth }
  }

  const firmadoPor = opts.firmadoPor.trim()
  if (firmadoPor.length < 3) {
    return { ok: false, error: 'Nombre del firmante inválido.', status: 400 }
  }

  const key = claveCartaFirmada(auth.ciclo_escolar, opts.alumnoId, auth.id)
  const uploaded = await subirCartaFirmadaPdf(opts.client, key, opts.pdfBytes)
  if (!uploaded) {
    return {
      ok: false,
      error: 'No se pudo guardar la carta firmada.',
      status: 500,
    }
  }

  const ahora = new Date().toISOString()
  const { data, error } = await opts.db
    .from('becas_autorizacion_firma')
    .update({
      beca_activada: true,
      beca_activada_en: ahora,
      firmado_por: firmadoPor,
      carta_firmada_bucket: BECAS_CARTAS_FIRMADAS_BUCKET,
      carta_firmada_key: uploaded.key,
      carta_firmada_url: uploaded.url,
    })
    .eq('id', auth.id)
    .eq('activo', true)
    .select(SELECT_AUT)
    .maybeSingle()

  if (error) return { ok: false, error: error.message, status: 500 }
  if (!data) {
    return { ok: false, error: 'No se pudo actualizar la autorización.', status: 500 }
  }

  return { ok: true, row: data as AutorizacionFirmaRow }
}
