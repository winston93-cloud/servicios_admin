import type { OpenpayConfigServidor } from './portalPagosSpei'
import { urlPdfSpeiOpenpay } from './portalPagosSpei'

export interface CrearCargoSpeiParams {
  config: OpenpayConfigServidor
  amount: number
  description: string
  orderId: string
  customerName: string
  customerEmail?: string
  deviceSessionId?: string
}

export interface CargoSpeiResultado {
  chargeId: string
  speiPdfUrl: string
  orderId: string
}

export async function crearCargoSpeiOpenpay(
  params: CrearCargoSpeiParams
): Promise<CargoSpeiResultado> {
  const { config } = params
  const formattedAmount = params.amount.toFixed(2)

  const payload: Record<string, unknown> = {
    method: 'bank_account',
    amount: formattedAmount,
    description: params.description.slice(0, 250),
    order_id: params.orderId,
    customer: {
      name: params.customerName.slice(0, 100),
      email: (params.customerEmail ?? 'pagos@winston93.edu.mx').slice(0, 100),
    },
  }

  if (params.deviceSessionId?.trim()) {
    payload.device_session_id = params.deviceSessionId.trim()
  }

  const url = `https://api.openpay.mx/v1/${config.merchantId}/charges`
  const auth = Buffer.from(`${config.secretKey}:`).toString('base64')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(payload),
  })

  const text = await res.text()
  let data: { id?: string; description?: string; error_code?: number; description_error?: string }
  try {
    data = JSON.parse(text) as typeof data
  } catch {
    throw new Error(`OpenPay respondió de forma inesperada (${res.status}).`)
  }

  if (!res.ok || !data.id) {
    const detalle = data.description ?? data.description_error ?? text.slice(0, 200)
    throw new Error(`OpenPay: ${detalle}`)
  }

  return {
    chargeId: data.id,
    speiPdfUrl: urlPdfSpeiOpenpay(config.merchantId, data.id),
    orderId: params.orderId,
  }
}
