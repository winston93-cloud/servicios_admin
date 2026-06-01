import { referenciaSemibase } from './boucherCore'
import { normalizarConceptoNo } from './pagoReferenciaColegiatura'

/** Primeros 9 dígitos: ref(5) + concepto(2) + ciclo(2). */
export function semibaseReferenciaPago(
  alumnoRef: string | number,
  conceptoNo: string,
  cicloEscolar: number
): string {
  return referenciaSemibase(alumnoRef, conceptoNo, cicloEscolar)
}

export function semibaseDesdeReferenciaCompleta(referencia: string): string {
  const d = referencia.replace(/\D/g, '')
  return d.length >= 9 ? d.slice(0, 9) : d
}

/**
 * Referencia OpenPay SPEI: semibase (9) + 3 dígitos aleatorios.
 * Solo para recibo SPEI; baucher y Banorte siguen con getDigVerif.
 */
export function generarReferenciaSpeiOpenpay(semibase: string): string {
  const base = semibase.replace(/\D/g, '').slice(0, 9)
  if (base.length !== 9) {
    throw new Error('La referencia base debe tener 9 dígitos para SPEI.')
  }
  const verificador = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  return `${base}${verificador}`
}

export function generarReferenciaSpeiDesdePago(
  alumnoRef: string | number,
  conceptoNo: string,
  cicloEscolar: number
): string {
  return generarReferenciaSpeiOpenpay(
    semibaseReferenciaPago(alumnoRef, normalizarConceptoNo(conceptoNo), cicloEscolar)
  )
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

export function obtenerConfigOpenpay(alumnoNivel: number): OpenpayConfigServidor {
  const cuenta = openpayCuentaPorNivel(alumnoNivel)
  const sandbox = envBool('OPENPAY_SANDBOX', false)

  if (cuenta === 'winston') {
    const merchantId = process.env.OPENPAY_WINSTON_MERCHANT_ID ?? ''
    const secretKey = process.env.OPENPAY_WINSTON_SECRET_KEY ?? ''
    const publicKey = process.env.OPENPAY_WINSTON_PUBLIC_KEY ?? ''
    if (!merchantId || !secretKey || !publicKey) {
      throw new Error('OpenPay Winston no está configurado en el servidor.')
    }
    return { cuenta, merchantId, secretKey, publicKey, sandbox }
  }

  const merchantId = process.env.OPENPAY_EDUCATIVO_MERCHANT_ID ?? ''
  const secretKey = process.env.OPENPAY_EDUCATIVO_SECRET_KEY ?? ''
  const publicKey = process.env.OPENPAY_EDUCATIVO_PUBLIC_KEY ?? ''
  if (!merchantId || !secretKey || !publicKey) {
    throw new Error('OpenPay Educativo no está configurado en el servidor.')
  }
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
