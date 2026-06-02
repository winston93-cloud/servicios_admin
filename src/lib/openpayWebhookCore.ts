import { createHmac, timingSafeEqual } from 'crypto'
import type { OpenpayCuenta } from './portalPagosSpei'

export interface OpenpayWebhookEvento {
  type: string
  verification_code?: string
  transaction?: {
    id?: string
    amount?: number | string
    order_id?: string
    description?: string
    error_code?: number
    error_message?: string
  }
  refund?: { id?: string; amount?: number | string }
  subscription?: { id?: string; amount?: number | string }
}

function compararFirmaConstante(esperada: string, recibida: string): boolean {
  try {
    const a = Buffer.from(esperada, 'utf8')
    const b = Buffer.from(recibida, 'utf8')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function firmaOpenpayEsperada(payload: string, secretKey: string): string {
  return createHmac('sha256', secretKey).update(payload, 'utf8').digest('base64')
}

function firmaOpenpayHex(payload: string, secretKey: string): string {
  return createHmac('sha256', secretKey).update(payload, 'utf8').digest('hex')
}

/** OpenPay MX: la verificación del webhook no documenta firma; solo exige 200 OK. */
export function eventoOpenpayEsVerificacion(evento: OpenpayWebhookEvento): boolean {
  return evento.type === 'verification'
}

export function validarFirmaOpenpay(
  payload: string,
  signatureHeader: string | null,
  secretKey: string
): boolean {
  if (!signatureHeader?.trim()) return false
  const recibida = signatureHeader.trim()
  if (compararFirmaConstante(firmaOpenpayEsperada(payload, secretKey), recibida)) return true
  if (compararFirmaConstante(firmaOpenpayHex(payload, secretKey), recibida)) return true
  return false
}

export function parsearEventoOpenpay(payload: string): OpenpayWebhookEvento | null {
  try {
    const data = JSON.parse(payload) as OpenpayWebhookEvento
    if (!data?.type) return null
    return data
  } catch {
    return null
  }
}

export function etiquetaCuentaOpenpay(cuenta: OpenpayCuenta): string {
  return cuenta === 'winston' ? 'Winston Churchill' : 'Educativo (Maternal/Kinder)'
}
