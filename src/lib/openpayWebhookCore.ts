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

/** Variantes del header Openpay-Signature (MX: base64 del body; a veces t=…,v1=…). */
function extraerFirmasCandidatas(header: string): string[] {
  const trimmed = header.trim()
  const out = new Set<string>()
  if (!trimmed) return []

  out.add(trimmed)

  for (const part of trimmed.split(',')) {
    const p = part.trim()
    if (!p) continue
    const eq = p.indexOf('=')
    if (eq > 0) {
      const val = p.slice(eq + 1).trim()
      if (val) out.add(val)
    } else {
      out.add(p)
    }
  }

  const v1 = trimmed.match(/\bv1=([^,\s]+)/i)
  if (v1?.[1]) out.add(v1[1].trim())

  return [...out]
}

function firmasEsperadasOpenpay(payload: string, secretKey: string): string[] {
  return [firmaOpenpayEsperada(payload, secretKey), firmaOpenpayHex(payload, secretKey)]
}

function compararHmacBinario(
  payload: string,
  secretKey: string,
  firmaRecibida: string
): boolean {
  const hmac = createHmac('sha256', secretKey).update(payload, 'utf8').digest()
  const rec = firmaRecibida.trim()
  for (const enc of ['base64', 'hex'] as const) {
    try {
      const sig = Buffer.from(rec, enc)
      if (sig.length === hmac.length && timingSafeEqual(sig, hmac)) return true
    } catch {
      /* formato no aplica */
    }
  }
  return false
}

/** Llaves a probar (SECRET_KEY, SECRET, lista alternativa). */
export function listarSecretKeysOpenpayWebhook(cuenta: OpenpayCuenta): string[] {
  const prefix = cuenta === 'winston' ? 'OPENPAY_WINSTON' : 'OPENPAY_EDUCATIVO'
  const keys = new Set<string>()
  for (const name of [`${prefix}_SECRET_KEY`, `${prefix}_SECRET`, `${prefix}_PRIVATE_KEY`]) {
    const v = process.env[name]?.trim()
    if (v) keys.add(v)
  }
  const lista = process.env[`${prefix}_SECRET_KEYS`]
  if (lista) {
    for (const part of lista.split(',')) {
      const v = part.trim()
      if (v) keys.add(v)
    }
  }
  return [...keys]
}

/**
 * OpenPay MX: la doc oficial usa verification_code, no HMAC obligatorio.
 * Por defecto relajado (como el PHP legacy con hash_equals roto).
 */
export function openpayRelajarValidacionFirma(): boolean {
  const v = process.env.OPENPAY_WEBHOOK_RELAX_SIGNATURE
  if (v == null || v === '') return true
  return v === '1' || v.toLowerCase() === 'true'
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
  if (!signatureHeader?.trim() || !secretKey.trim()) return false

  const esperadas = firmasEsperadasOpenpay(payload, secretKey)
  const recibidas = extraerFirmasCandidatas(signatureHeader)

  for (const rec of recibidas) {
    for (const esp of esperadas) {
      if (compararFirmaConstante(esp, rec)) return true
    }
    if (compararHmacBinario(payload, secretKey, rec)) return true
  }
  return false
}

export function validarFirmaOpenpayConClaves(
  payload: string,
  signatureHeader: string | null,
  secretKeys: string[]
): boolean {
  for (const key of secretKeys) {
    if (validarFirmaOpenpay(payload, signatureHeader, key)) return true
  }
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
