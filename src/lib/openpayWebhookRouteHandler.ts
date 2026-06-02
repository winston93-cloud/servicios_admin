import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from './supabaseAdmin'
import {
  eventoOpenpayEsVerificacion,
  parsearEventoOpenpay,
  validarFirmaOpenpay,
} from './openpayWebhookCore'
import { procesarWebhookOpenpay } from './openpayWebhookService'
import {
  obtenerConfigOpenpayPorCuenta,
  type OpenpayCuenta,
} from './portalPagosSpei'

export async function manejarPostWebhookOpenpay(
  request: Request,
  cuenta: OpenpayCuenta
): Promise<NextResponse> {
  const payload = await request.text()
  const signature =
    request.headers.get('openpay-signature') ??
    request.headers.get('Openpay-Signature')

  let config
  try {
    config = obtenerConfigOpenpayPorCuenta(cuenta)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'OpenPay no configurado'
    console.error(`webhook openpay/${cuenta} config:`, msg)
    return NextResponse.json({ error: msg }, { status: 503 })
  }

  const evento = parsearEventoOpenpay(payload)
  if (!evento) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const esVerificacion = eventoOpenpayEsVerificacion(evento)
  if (
    !esVerificacion &&
    !validarFirmaOpenpay(payload, signature, config.secretKey)
  ) {
    console.error(`webhook openpay/${cuenta}: firma inválida`)
    try {
      const supabase = createSupabaseAdmin()
      await supabase.from('openpay_webhook_log').insert({
        cuenta,
        tipo_evento: 'signature.invalid',
        ok: false,
        mensaje: 'Firma inválida',
        payload: { signaturePresent: Boolean(signature), type: evento.type },
      })
    } catch {
      /* ignore log failure */
    }
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  if (
    esVerificacion &&
    signature &&
    !validarFirmaOpenpay(payload, signature, config.secretKey)
  ) {
    console.warn(
      `webhook openpay/${cuenta}: verification con firma distinta; se acepta (OpenPay MX)`
    )
  }

  let payloadJson: unknown = null
  try {
    payloadJson = JSON.parse(payload)
  } catch {
    payloadJson = { raw: payload.slice(0, 500) }
  }

  const supabase = createSupabaseAdmin()
  const resultado = await procesarWebhookOpenpay(supabase, cuenta, evento, payloadJson)

  if (!resultado.ok) {
    console.error(`webhook openpay/${cuenta}:`, resultado.mensaje)
  }

  return NextResponse.json(
    { received: true, ...resultado },
    { status: 200 }
  )
}
