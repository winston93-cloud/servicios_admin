import type { SupabaseClient } from '@supabase/supabase-js'
import { formatearAlumnoRefParaReferencia, normalizarConceptoNo } from './pagoReferenciaColegiatura'
import type { OpenpayCuenta } from './portalPagosSpei'
import {
  etiquetaCuentaOpenpay,
  type OpenpayWebhookEvento,
} from './openpayWebhookCore'

export interface ResultadoWebhookOpenpay {
  ok: boolean
  mensaje: string
  tipo?: string
}

async function registrarLog(
  supabase: SupabaseClient,
  cuenta: OpenpayCuenta,
  tipo: string,
  ok: boolean,
  mensaje: string,
  payload: unknown,
  extra?: { referencia?: string; transaction_id?: string }
): Promise<void> {
  const { error } = await supabase.from('openpay_webhook_log').insert({
    cuenta,
    tipo_evento: tipo,
    referencia: extra?.referencia ?? null,
    transaction_id: extra?.transaction_id ?? null,
    ok,
    mensaje,
    payload: payload as Record<string, unknown>,
  })
  if (error) console.error('openpay_webhook_log:', error.message)
}

async function guardarCodigoVerificacion(
  supabase: SupabaseClient,
  cuenta: OpenpayCuenta,
  codigo: string
): Promise<void> {
  const { error } = await supabase.from('openpay_webhook_verificacion').insert({
    cuenta,
    verification_code: codigo,
  })
  if (error) throw new Error(error.message)
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

async function buscarAlumnoPorReferencia(
  supabase: SupabaseClient,
  referencia: string
): Promise<{ alumno_id: number; pago_nombre: string } | null> {
  const ref5 = formatearAlumnoRefParaReferencia(referencia.slice(0, 5))
  const refNum = parseInt(ref5, 10)

  const { data, error } = await supabase
    .from('alumno')
    .select('alumno_id, alumno_nombre, alumno_app, alumno_apm')
    .eq('alumno_ref', refNum)
    .maybeSingle()

  if (error || !data) return null

  const pago_nombre =
    `${data.alumno_app ?? ''} ${data.alumno_apm ?? ''} ${data.alumno_nombre ?? ''}`.trim() ||
    'Alumno'

  return { alumno_id: data.alumno_id, pago_nombre }
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

async function insertarPagoOpenpay(
  supabase: SupabaseClient,
  alumnoId: number,
  pagoNombre: string,
  referencia: string,
  importe: number
): Promise<void> {
  const pagoId = (await obtenerMaxPagoId(supabase)) + 1
  const ahora = new Date().toISOString()
  const hoy = ahora.slice(0, 10)

  const { error } = await supabase.from('pago_detalle').insert({
    pago_id: pagoId,
    alumno_id: alumnoId,
    pago_nombre: pagoNombre,
    pago_referencia: referencia.replace(/\D/g, '').slice(0, 12),
    pago_importe: importe,
    pago_recargo: 0,
    pago_forma: 'Openpay',
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

  if (error) throw new Error(error.message)
}

async function procesarChargeSucceeded(
  supabase: SupabaseClient,
  cuenta: OpenpayCuenta,
  evento: OpenpayWebhookEvento,
  tipoEvento = 'charge.succeeded'
): Promise<ResultadoWebhookOpenpay> {
  const tx = evento.transaction
  const referencia = String(tx?.order_id ?? '').replace(/\D/g, '')
  const importe = parseFloat(String(tx?.amount ?? '0'))
  const transactionId = tx?.id ?? ''
  const status = String((tx as { status?: string })?.status ?? '').toLowerCase()

  if (referencia.length < 9 || !Number.isFinite(importe) || importe <= 0) {
    return { ok: false, mensaje: 'Cargo sin referencia o importe válido', tipo: tipoEvento }
  }

  if (status && status !== 'completed' && status !== 'success') {
    return {
      ok: true,
      mensaje: `Cargo aún no liquidado (status=${status}); se espera completed`,
      tipo: tipoEvento,
    }
  }

  if (await existePagoPorReferencia(supabase, referencia)) {
    return {
      ok: true,
      mensaje: `Pago ya registrado (${referencia})`,
      tipo: tipoEvento,
    }
  }

  await activarAlumnoInscripcion(supabase, referencia)

  const alumno = await buscarAlumnoPorReferencia(supabase, referencia)
  if (!alumno) {
    return {
      ok: false,
      mensaje: `Alumno no encontrado para ref ${referencia.slice(0, 5)}`,
      tipo: tipoEvento,
    }
  }

  await insertarPagoOpenpay(supabase, alumno.alumno_id, alumno.pago_nombre, referencia, importe)

  return {
    ok: true,
    mensaje: `Pago registrado (${etiquetaCuentaOpenpay(cuenta)}) ref=${referencia} txn=${transactionId}`,
    tipo: tipoEvento,
  }
}

export async function procesarWebhookOpenpay(
  supabase: SupabaseClient,
  cuenta: OpenpayCuenta,
  evento: OpenpayWebhookEvento,
  payloadCrudo: unknown
): Promise<ResultadoWebhookOpenpay> {
  const tipo = evento.type

  try {
    switch (tipo) {
      case 'verification': {
        const codigo = String(evento.verification_code ?? '').trim()
        if (!codigo) {
          return { ok: false, mensaje: 'verification sin código', tipo }
        }
        await guardarCodigoVerificacion(supabase, cuenta, codigo)
        await registrarLog(supabase, cuenta, tipo, true, `Código: ${codigo}`, payloadCrudo)
        return {
          ok: true,
          mensaje: `Código de verificación guardado (${cuenta})`,
          tipo,
        }
      }

      case 'charge.succeeded':
      case 'spei.received': {
        const res = await procesarChargeSucceeded(supabase, cuenta, evento, tipo)
        await registrarLog(supabase, cuenta, tipo, res.ok, res.mensaje, payloadCrudo, {
          referencia: evento.transaction?.order_id,
          transaction_id: evento.transaction?.id,
        })
        return res
      }

      case 'charge.created':
      case 'charge.failed': {
        const msg =
          tipo === 'charge.failed'
            ? `Pago fallido: ${evento.transaction?.error_message ?? 'sin detalle'}`
            : 'Cargo creado (pendiente de liquidación)'
        await registrarLog(supabase, cuenta, tipo, true, msg, payloadCrudo, {
          referencia: evento.transaction?.order_id,
          transaction_id: evento.transaction?.id,
        })
        return { ok: true, mensaje: msg, tipo }
      }

      default: {
        await registrarLog(supabase, cuenta, tipo, true, 'Evento no manejado', payloadCrudo)
        return { ok: true, mensaje: `Evento no manejado: ${tipo}`, tipo }
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al procesar webhook'
    await registrarLog(supabase, cuenta, tipo, false, msg, payloadCrudo)
    return { ok: false, mensaje: msg, tipo }
  }
}

export async function listarUltimasVerificaciones(
  supabase: SupabaseClient,
  cuenta?: OpenpayCuenta,
  limite = 5
) {
  let q = supabase
    .from('openpay_webhook_verificacion')
    .select('id, cuenta, verification_code, recibido_en')
    .order('recibido_en', { ascending: false })
    .limit(limite)

  if (cuenta) q = q.eq('cuenta', cuenta)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

export function urlsWebhookOpenpay(baseUrl: string) {
  const base = baseUrl.replace(/\/$/, '')
  return {
    winston: `${base}/api/webhooks/openpay/winston`,
    educativo: `${base}/api/webhooks/openpay/educativo`,
  }
}
