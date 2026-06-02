import {
  generarReferenciaPagoAleatoria,
  generarReferenciaPagoDesdePago,
} from './pagoReferenciaColegiatura'

export {
  semibaseReferenciaPago,
  semibaseDesdeReferenciaCompleta,
} from './pagoReferenciaColegiatura'

/** @deprecated Use generarReferenciaPagoAleatoria — mismo comportamiento. */
export function generarReferenciaSpeiOpenpay(semibase: string): string {
  return generarReferenciaPagoAleatoria(semibase)
}

/** @deprecated Use generarReferenciaPagoDesdePago */
export function generarReferenciaSpeiDesdePago(
  alumnoRef: string | number,
  conceptoNo: string,
  cicloEscolar: number
): string {
  return generarReferenciaPagoDesdePago(alumnoRef, conceptoNo, cicloEscolar)
}

export type OpenpayCuenta = 'winston' | 'educativo'

export function openpayCuentaPorNivel(alumnoNivel: number): OpenpayCuenta {
  return alumnoNivel >= 3 ? 'winston' : 'educativo'
}

export interface OpenpayConfigPublica {
  cuenta: OpenpayCuenta
  merchantId: string
  publicKey: string
  sandbox: boolean
}

export interface OpenpayConfigServidor extends OpenpayConfigPublica {
  secretKey: string
}

function envBool(name: string, fallback = false): boolean {
  const v = process.env[name]
  if (v == null || v === '') return fallback
  return v === '1' || v.toLowerCase() === 'true'
}

/** Acepta el primer nombre definido (p. ej. *_SECRET_KEY o *_SECRET en Vercel). */
function envPrimero(...nombres: string[]): string {
  for (const n of nombres) {
    const v = process.env[n]?.trim()
    if (v) return v
  }
  return ''
}

function validarOpenpay(
  cuenta: OpenpayCuenta,
  merchantId: string,
  secretKey: string,
  publicKey: string
): void {
  const faltan: string[] = []
  if (!merchantId) faltan.push('MERCHANT_ID')
  if (!secretKey) faltan.push('SECRET o SECRET_KEY')
  if (!publicKey) faltan.push('PUBLIC o PUBLIC_KEY')
  if (faltan.length === 0) return
  const prefijo = cuenta === 'winston' ? 'OPENPAY_WINSTON_' : 'OPENPAY_EDUCATIVO_'
  throw new Error(
    `OpenPay ${cuenta === 'winston' ? 'Winston' : 'Educativo'} incompleto en Vercel: falta ${prefijo}${faltan.join(', ' + prefijo)}.`
  )
}

export function obtenerConfigOpenpayPorCuenta(cuenta: OpenpayCuenta): OpenpayConfigServidor {
  return obtenerConfigOpenpay(cuenta === 'winston' ? 4 : 1)
}

export function obtenerConfigOpenpay(alumnoNivel: number): OpenpayConfigServidor {
  const cuenta = openpayCuentaPorNivel(alumnoNivel)
  const sandbox = envBool('OPENPAY_SANDBOX', false)

  if (cuenta === 'winston') {
    const merchantId = envPrimero('OPENPAY_WINSTON_MERCHANT_ID')
    const secretKey = envPrimero('OPENPAY_WINSTON_SECRET_KEY', 'OPENPAY_WINSTON_SECRET')
    const publicKey = envPrimero('OPENPAY_WINSTON_PUBLIC_KEY', 'OPENPAY_WINSTON_PUBLIC')
    validarOpenpay('winston', merchantId, secretKey, publicKey)
    return { cuenta, merchantId, secretKey, publicKey, sandbox }
  }

  const merchantId = envPrimero('OPENPAY_EDUCATIVO_MERCHANT_ID')
  const secretKey = envPrimero('OPENPAY_EDUCATIVO_SECRET_KEY', 'OPENPAY_EDUCATIVO_SECRET')
  const publicKey = envPrimero('OPENPAY_EDUCATIVO_PUBLIC_KEY', 'OPENPAY_EDUCATIVO_PUBLIC')
  validarOpenpay('educativo', merchantId, secretKey, publicKey)
  return { cuenta, merchantId, secretKey, publicKey, sandbox }
}

export function configOpenpayPublica(config: OpenpayConfigServidor): OpenpayConfigPublica {
  return {
    cuenta: config.cuenta,
    merchantId: config.merchantId,
    publicKey: config.publicKey,
    sandbox: config.sandbox,
  }
}

export function urlPdfSpeiOpenpay(merchantId: string, chargeId: string): string {
  return `https://dashboard.openpay.mx/spei-pdf/${merchantId}/${chargeId}`
}
