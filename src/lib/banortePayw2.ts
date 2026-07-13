import type { BanorteCredencialesPayw2 } from './banorteConfig'
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
}

/** POST servidor a Payworks (legacy process_payment.php). */
export async function ejecutarVentaPayw2(
  campos: Record<string, string>,
  credenciales: BanorteCredencialesPayw2
): Promise<RespuestaPayw2> {
  const body = new URLSearchParams({
    MERCHANT_ID: credenciales.merchantId,
    USER: credenciales.user,
    PASSWORD: credenciales.password,
    TERMINAL_ID: credenciales.terminalId,
    CMD_TRANS: 'VENTA',
    MODE: 'PRD',
    ENTRY_MODE: 'MANUAL',
    RESPONSE_LANGUAGE: 'EN',
    ...campos,
  })

  const res = await fetch('https://via.pagosbanorte.com/payw2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: body.toString(),
    cache: 'no-store',
  })

  const headers: Record<string, string> = {}
  res.headers.forEach((value, key) => {
    headers[key.toUpperCase()] = value
  })

  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = headers[k.toUpperCase()]
      if (v) return v
    }
    return null
  }

  return {
    headers,
    paywResult: pick('PAYW_RESULT'),
    authResult: pick('AUTH_RESULT'),
    paywCode: pick('PAYW_CODE'),
    authCode: pick('AUTH_CODE'),
    text: pick('TEXT'),
    controlNumber: pick('CONTROL_NUMBER', 'NUMERO_CONTROL'),
    cardHolder: pick('CARD_HOLDER'),
  }
}

export function mensajeResultadoPayw2(resp: RespuestaPayw2): string {
  if (resp.paywResult === 'A') return 'Operación aprobada.'
  const d = obtenerDetalleErrorPayw2(resp)
  return d.paywCode ? `${d.mensaje} — ${d.paywCode}` : d.mensaje
}
