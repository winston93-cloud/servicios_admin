/**
 * Estado de autorización / activación de beca para firma electrónica.
 */
import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AppInsforgeClient } from '@/lib/dbTypes'
import {
  cicloBecaARenovarFirma,
  cicloFirmaBecaActual,
} from './cicloFirmaBeca'
import type { FlujoFirmaBeca } from './cartaAceptacionPayload'
import {
  BECAS_CARTAS_FIRMADAS_BUCKET,
  claveCartaFirmada,
  subirCartaFirmadaPdf,
} from './cartaFirmadaStorage'
import { activarAlumnoBecaCobroCicloActual } from './activarAlumnoBecaCobro'

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

export type EstadoFirmaBecaPortal = {
  autorizada: boolean
  activada: boolean
  ciclo: number
  flujo?: FlujoFirmaBeca
  expedienteId?: string
  firmadoPor?: string | null
  activadaEn?: string | null
  tieneCartaFirmada?: boolean
  row: AutorizacionFirmaRow | null
}

/** Renovación (ciclo origen) y solicitud (ciclo calendario) con beca autorizada. */
export async function resolverEstadoFirmaBecaPortal(
  db: AppDatabaseClient,
  alumnoId: number
): Promise<EstadoFirmaBecaPortal> {
  const cicloCal = cicloFirmaBecaActual()
  const row = await obtenerAutorizacionFirmaActiva(db, alumnoId, cicloCal)

  if (row) {
    return {
      autorizada: true,
      activada: Boolean(row.beca_activada),
      ciclo: row.ciclo_escolar,
      flujo: row.flujo,
      expedienteId: row.expediente_id,
      firmadoPor: row.firmado_por,
      activadaEn: row.beca_activada_en,
      tieneCartaFirmada: Boolean(row.carta_firmada_key),
      row,
    }
  }

  const cicloOrigen = cicloBecaARenovarFirma()

  const { data: ren, error: renErr } = await db
    .from('becas_renovacion')
    .select('id')
    .eq('alumno_id', alumnoId)
    .eq('ciclo_escolar', cicloOrigen)
    .eq('beca_autorizada', true)
    .maybeSingle()

  if (renErr) throw new Error(renErr.message)
  if (ren?.id) {
    return {
      autorizada: true,
      activada: false,
      ciclo: cicloCal,
      flujo: 'renovacion',
      expedienteId: String(ren.id),
      row: null,
    }
  }

  const { data: sol, error: solErr } = await db
    .from('becas_solicitud')
    .select('id')
    .eq('alumno_id', alumnoId)
    .eq('ciclo_escolar', cicloCal)
    .eq('beca_autorizada', true)
    .maybeSingle()

  if (solErr) throw new Error(solErr.message)
  if (sol?.id) {
    return {
      autorizada: true,
      activada: false,
      ciclo: cicloCal,
      flujo: 'solicitud',
      expedienteId: String(sol.id),
      row: null,
    }
  }

  return {
    autorizada: false,
    activada: false,
    ciclo: cicloCal,
    row: null,
  }
}

/** Asegura fila en becas_autorizacion_firma si el expediente ya está autorizado. */
export async function asegurarAutorizacionFirmaActiva(
  db: AppDatabaseClient,
  estado: EstadoFirmaBecaPortal
): Promise<AutorizacionFirmaRow | null> {
  if (!estado.autorizada || !estado.flujo || !estado.expedienteId) return null
  if (estado.row) return estado.row

  const cicloCal = cicloFirmaBecaActual()
  const ahora = new Date().toISOString()

  const { data: expedienteAlumno } = await db
    .from(estado.flujo === 'renovacion' ? 'becas_renovacion' : 'becas_solicitud')
    .select('alumno_id')
    .eq('id', estado.expedienteId)
    .maybeSingle()

  const alumnoId = Number(expedienteAlumno?.alumno_id)
  if (!(alumnoId > 0)) return null

  const fila = {
    alumno_id: alumnoId,
    ciclo_escolar: cicloCal,
    flujo: estado.flujo,
    expediente_id: estado.expedienteId,
    activo: true,
    autorizado_en: ahora,
    revocado_en: null,
  }

  const { data: existente } = await db
    .from('becas_autorizacion_firma')
    .select('id')
    .eq('alumno_id', alumnoId)
    .eq('ciclo_escolar', cicloCal)
    .maybeSingle()

  if (existente?.id) {
    const { data, error } = await db
      .from('becas_autorizacion_firma')
      .update(fila)
      .eq('id', existente.id)
      .select(SELECT_AUT)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data as AutorizacionFirmaRow | null
  }

  const { data, error } = await db
    .from('becas_autorizacion_firma')
    .insert([fila])
    .select(SELECT_AUT)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as AutorizacionFirmaRow | null
}

export async function resolverAutorizacionFirmaParaAlumno(
  db: AppDatabaseClient,
  alumnoId: number
): Promise<EstadoFirmaBecaPortal> {
  const estado = await resolverEstadoFirmaBecaPortal(db, alumnoId)
  if (!estado.autorizada) return estado
  const row = await asegurarAutorizacionFirmaActiva(db, estado)
  if (row) {
    return {
      ...estado,
      activada: Boolean(row.beca_activada),
      firmadoPor: row.firmado_por,
      activadaEn: row.beca_activada_en,
      tieneCartaFirmada: Boolean(row.carta_firmada_key),
      row,
    }
  }
  return estado
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

  const firmadoPor = opts.firmadoPor.trim()
  if (firmadoPor.length < 3) {
    return { ok: false, error: 'Nombre del firmante inválido.', status: 400 }
  }

  if (auth.beca_activada && auth.carta_firmada_key) {
    const cobro = await activarAlumnoBecaCobroCicloActual(opts.db, auth)
    if (!cobro.ok) {
      return { ok: false, error: cobro.error, status: cobro.status ?? 500 }
    }
    return { ok: true, row: auth }
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

  const cobro = await activarAlumnoBecaCobroCicloActual(opts.db, auth)
  if (!cobro.ok) {
    return { ok: false, error: cobro.error, status: cobro.status ?? 500 }
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
