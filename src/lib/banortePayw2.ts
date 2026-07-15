import {
  BANORTE_PAYW2_URL,
  claveProxyPayw2,
  type BanorteCredencialesPayw2,
  urlProxyPayw2,
  usarProxyPayw2,
} from './banorteConfig'
import { obtenerDetalleErrorPayw2 } from './banortePaywErrors'

export interface RespuestaPayw2 {
  headers: Record<string, string>
  paywResult: string | null
  authResult: string | null
  paywCode: string | null
  authCode: string | null
  text: string | null
  controlNumber: string | null
  cardHolder: string | null
  via: 'proxy' | 'direct'
}

const CAMPOS_VENTA_ORDEN = [
  'MERCHANT_ID',
  'USER',
  'PASSWORD',
  'TERMINAL_ID',
  'CMD_TRANS',
  'MODE',
  'ENTRY_MODE',
  'RESPONSE_LANGUAGE',
  'CONTROL_NUMBER',
  'ECI',
  'STATUS_3D',
  'XID',
  'CAVV',
  'VERSION_3D',
  'CUSTOMER_REF1',
  'CARD_NUMBER',
  'CARD_EXP',
  'SECURITY_CODE',
  'AMOUNT',
] as const

/** Armar body como el form HTML del legacy (http_build_query). */
export function construirBodyVentaPayw2(
  campos: Record<string, string>,
  credenciales: BanorteCredencialesPayw2
): string {
  const merged: Record<string, string> = {
    MERCHANT_ID: credenciales.merchantId,
    USER: credenciales.user,
    PASSWORD: credenciales.password,
    TERMINAL_ID: credenciales.terminalId,
    CMD_TRANS: 'VENTA',
    MODE: 'PRD',
    ENTRY_MODE: 'MANUAL',
    RESPONSE_LANGUAGE: 'EN',
    ...campos,
  }

  const params = new URLSearchParams()
  for (const key of CAMPOS_VENTA_ORDEN) {
    const value = merged[key]
    if (value == null || value === '') continue
    params.append(key, value)
  }
  // Cualquier campo extra que Banorte haya añadido (sin secretos internos).
  for (const [key, value] of Object.entries(merged)) {
    if ((CAMPOS_VENTA_ORDEN as readonly string[]).includes(key)) continue
    if (key.startsWith('__')) continue
    if (value == null || value === '') continue
    params.append(key, value)
  }
  return params.toString()
}

function pickHeaders(headers: Record<string, string>): RespuestaPayw2 {
  const upper: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    upper[k.toUpperCase()] = v
  }
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = upper[k.toUpperCase()]
      if (v) return v
    }
    return null
  }
  return {
    headers: upper,
    paywResult: pick('PAYW_RESULT'),
    authResult: pick('AUTH_RESULT'),
    paywCode: pick('PAYW_CODE'),
    authCode: pick('AUTH_CODE'),
    text: pick('TEXT'),
    controlNumber: pick('CONTROL_NUMBER', 'NUMERO_CONTROL'),
    cardHolder: pick('CARD_HOLDER'),
    via: 'direct',
  }
}

async function postPayw2Direct(body: string): Promise<RespuestaPayw2> {
  const res = await fetch(BANORTE_PAYW2_URL, {
    method: 'POST',
    headers: {
      // Igual que cURL del proceso legacy (sin charset).
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: '*/*',
    },
    body,
    cache: 'no-store',
  })

  const headers: Record<string, string> = {}
  res.headers.forEach((value, key) => {
    headers[key.toUpperCase()] = value
  })
  return { ...pickHeaders(headers), via: 'direct' }
}

async function postPayw2ViaProxy(body: string): Promise<RespuestaPayw2> {
  const proxyUrl = urlProxyPayw2()
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'X-Banorte-Proxy-Key': claveProxyPayw2(),
    },
    body,
    cache: 'no-store',
  })

  const text = await res.text()
  type ProxyJson = {
    ok?: boolean
    error?: string
    message?: string
    headers?: Record<string, string>
  }
  let json: ProxyJson
  try {
    json = JSON.parse(text) as ProxyJson
  } catch {
    throw new Error(
      `Proxy Payworks respondió HTML/texto no JSON (HTTP ${res.status}). ¿Subió payw2_proxy.php a winston93?`
    )
  }

  if (!res.ok || !json.ok || !json.headers) {
    const detalle = json.message || json.error || `HTTP ${res.status}`
    throw new Error(`Proxy Payworks falló: ${detalle}`)
  }

  return { ...pickHeaders(json.headers), via: 'proxy' }
}

/**
 * POST servidor a Payworks (igual que process_payment.php).
 * Por defecto sale directo desde Vercel. Proxy solo si se activa a propósito.
 */
export async function ejecutarVentaPayw2(
  campos: Record<string, string>,
  credenciales: BanorteCredencialesPayw2
): Promise<RespuestaPayw2> {
  const body = construirBodyVentaPayw2(campos, credenciales)

  if (usarProxyPayw2()) {
    return postPayw2ViaProxy(body)
  }

  return postPayw2Direct(body)
}

export function mensajeResultadoPayw2(resp: RespuestaPayw2): string {
  if (resp.paywResult === 'A') return 'Operación aprobada.'
  const d = obtenerDetalleErrorPayw2(resp)
  return d.paywCode ? `${d.mensaje} — ${d.paywCode}` : d.mensaje
}
