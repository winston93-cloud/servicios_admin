import type { SupabaseClient } from '@supabase/supabase-js'
import type { DetalleErrorPayw2 } from './banortePaywErrors'
import type { RespuestaPayw2 } from './banortePayw2'
import { formatearAlumnoRefParaReferencia, normalizarConceptoNo } from './pagoReferenciaColegiatura'

export function normalizarReferenciaBanorte(ref: string): string {
  return String(ref ?? '').replace(/\D/g, '').slice(0, 12)
}

export async function guardarMontoPendienteBanorte(
  supabase: SupabaseClient,
  referencia: string,
  monto: number
): Promise<void> {
  const ref = normalizarReferenciaBanorte(referencia)
  if (ref.length !== 12) throw new Error('Referencia de pago inválida (12 dígitos).')

  const { error } = await supabase.from('banorte_pago_pendiente').upsert(
    { referencia: ref, monto: Number(monto.toFixed(2)) },
    { onConflict: 'referencia' }
  )

  if (error) {
    if (error.code === '42P01') {
      throw new Error(
        'Falta la tabla banorte_pago_pendiente en Supabase. Ejecute sql/banorte_pago_pendiente_add.sql'
      )
    }
    throw new Error(error.message)
  }
}

export async function obtenerMontoPendienteBanorte(
  supabase: SupabaseClient,
  referencia: string
): Promise<number | null> {
  const ref = normalizarReferenciaBanorte(referencia)
  const { data, error } = await supabase
    .from('banorte_pago_pendiente')
    .select('monto')
    .eq('referencia', ref)
    .maybeSingle()

  if (error) {
    if (error.code === '42P01') return null
    console.error('obtenerMontoPendienteBanorte:', error.message)
    return null
  }

  if (data?.monto == null) return null
  return Number(data.monto)
}

async function obtenerMaxPagoId(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('pago_detalle')
    .select('pago_id')
    .order('pago_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || data?.pago_id == null) return 0
  return Number(data.pago_id)
}

async function existePagoPorReferencia(
  supabase: SupabaseClient,
  referencia: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('pago_detalle')
    .select('pago_id', { count: 'exact', head: true })
    .eq('pago_referencia', referencia)

  if (error) {
    console.error('existePagoPorReferencia:', error.message)
    return true
  }
  return (count ?? 0) > 0
}

async function buscarAlumnoPorReferencia(
  supabase: SupabaseClient,
  referencia: string
): Promise<{ alumno_id: number; pago_nombre: string; alumno_nivel: number } | null> {
  const ref5 = formatearAlumnoRefParaReferencia(referencia.slice(0, 5))
  const refNum = parseInt(ref5, 10)

  const { data, error } = await supabase
    .from('alumno')
    .select('alumno_id, alumno_nombre, alumno_app, alumno_apm, alumno_nivel')
    .eq('alumno_ref', refNum)
    .maybeSingle()

  if (error || !data) return null

  const pago_nombre =
    `${data.alumno_app ?? ''} ${data.alumno_apm ?? ''} ${data.alumno_nombre ?? ''}`.trim() ||
    'Alumno'

  return {
    alumno_id: data.alumno_id,
    pago_nombre,
    alumno_nivel: Number(data.alumno_nivel ?? 0),
  }
}

async function activarAlumnoInscripcion(
  supabase: SupabaseClient,
  referencia: string
): Promise<void> {
  if (normalizarConceptoNo(referencia.slice(5, 7)) !== '13') return
  const ref5 = formatearAlumnoRefParaReferencia(referencia.slice(0, 5))
  const refNum = parseInt(ref5, 10)
  const { error } = await supabase
    .from('alumno')
    .update({ alumno_status: 1 })
    .eq('alumno_ref', refNum)
  if (error) console.error('activarAlumnoInscripcion:', error.message)
}

export interface ResultadoRegistroPagoBanorte {
  ok: boolean
  mensaje: string
  duplicado?: boolean
}

/**
 * Registra pago en Supabase tras Payworks exitoso.
 * Facturación CFDI: en pausa (no se timbra aquí).
 */
export async function registrarPagoBanorteExitoso(
  supabase: SupabaseClient,
  referencia: string,
  importe: number
): Promise<ResultadoRegistroPagoBanorte> {
  const ref = normalizarReferenciaBanorte(referencia)
  if (ref.length !== 12) {
    return { ok: false, mensaje: 'Referencia inválida.' }
  }

  if (await existePagoPorReferencia(supabase, ref)) {
    return {
      ok: true,
      mensaje: 'Este pago ya estaba registrado.',
      duplicado: true,
    }
  }

  const alumno = await buscarAlumnoPorReferencia(supabase, ref)
  if (!alumno) {
    return { ok: false, mensaje: 'No se encontró el alumno para esta referencia.' }
  }

  const pagoId = (await obtenerMaxPagoId(supabase)) + 1
  const ahora = new Date().toISOString()
  const hoy = ahora.slice(0, 10)

  const { error } = await supabase.from('pago_detalle').insert({
    pago_id: pagoId,
    alumno_id: alumno.alumno_id,
    pago_nombre: alumno.pago_nombre,
    pago_referencia: ref,
    pago_importe: importe,
    pago_recargo: 0,
    pago_forma: 'Comercio Electronico',
    pago_folio: null,
    pago_fecha: hoy,
    pago_hora: '09:00:00 a.m.',
    pago_emisora: 'S/E',
    pago_cancelado: 0,
    pago_registro: ahora,
    pago_actualizacion: ahora,
    facturo: '',
    fact: '',
  })

  if (error) {
    return { ok: false, mensaje: error.message }
  }

  await activarAlumnoInscripcion(supabase, ref)

  await supabase.from('banorte_pago_pendiente').delete().eq('referencia', ref)

  return {
    ok: true,
    mensaje: 'Pago registrado correctamente. La factura se emitirá cuando el proceso esté activo.',
  }
}


/** Guarda intento fallido Payworks (Anexo A) para soporte y reportes. */
export async function registrarIntentoPaywFallido(
  supabase: SupabaseClient,
  referencia: string,
  importe: number,
  resp: RespuestaPayw2,
  detalle: DetalleErrorPayw2
): Promise<void> {
  const ref = normalizarReferenciaBanorte(referencia)
  const { error } = await supabase.from('banorte_payw_intento').insert({
    referencia: ref,
    importe: Number.isFinite(importe) ? Number(importe.toFixed(2)) : null,
    payw_result: resp.paywResult,
    payw_code: detalle.paywCode ?? resp.paywCode,
    auth_result: resp.authResult,
    auth_code: resp.authCode,
    mensaje_es: detalle.mensaje,
    mensaje_raw: resp.text,
  })
  if (error) {
    if (error.code === '42P01') {
      console.warn('banorte_payw_intento: ejecute sql/banorte_payw_intento_add.sql')
      return
    }
    console.error('registrarIntentoPaywFallido:', error.message)
  }
}
