import { X509Certificate } from 'node:crypto'
import {
  CFDI_EMISOR_CHURCHILL_RFC,
  CFDI_EMISOR_EDUCATIVO_RFC,
} from '../cfdiConfig'
import type { CfdiEmisorClave } from './cfdiTypes'

/** ≤ 30 días (o vencido) → rojo; ≤ 90 → amarillo. */
export const CSD_DIAS_ALERTA_ROJA = 30
export const CSD_DIAS_ALERTA_AMARILLA = 90

export type CsdAlertaNivel = 'ok' | 'amarillo' | 'rojo' | 'sin_csd' | 'error'

export type CsdVencimientoFila = {
  clave: CfdiEmisorClave
  empresa: string
  rfc: string
  vigenteDesde: string | null
  vence: string | null
  diasRestantes: number | null
  alerta: CsdAlertaNivel
  mensaje?: string
}

function csdEnv(prefix: 'CHURCHILL' | 'EDUCATIVO'): string {
  return process.env[`FACTUROPORTI_${prefix}_CSD`]?.trim() ?? ''
}

function inicioDiaUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/** Días calendario hasta la fecha de vencimiento (UTC). Negativo = ya venció. */
export function diasHastaVencimiento(vence: Date, ahora = new Date()): number {
  const a = inicioDiaUtc(ahora).getTime()
  const b = inicioDiaUtc(vence).getTime()
  return Math.round((b - a) / 86_400_000)
}

export function alertaPorDias(dias: number): Exclude<CsdAlertaNivel, 'sin_csd' | 'error'> {
  if (dias <= CSD_DIAS_ALERTA_ROJA) return 'rojo'
  if (dias <= CSD_DIAS_ALERTA_AMARILLA) return 'amarillo'
  return 'ok'
}

function formatearFechaMx(d: Date): string {
  return d.toLocaleDateString('es-MX', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function parsearCsd(b64: string): { desde: Date; hasta: Date } {
  const der = Buffer.from(b64.replace(/\s/g, ''), 'base64')
  const cert = new X509Certificate(der)
  const desde = new Date(cert.validFrom)
  const hasta = new Date(cert.validTo)
  if (Number.isNaN(desde.getTime())) {
    throw new Error('No se pudo leer notBefore del CSD')
  }
  if (Number.isNaN(hasta.getTime())) {
    throw new Error('No se pudo leer notAfter del CSD')
  }
  return { desde, hasta }
}

function filaEmisor(
  clave: CfdiEmisorClave,
  empresa: string,
  rfc: string,
  prefix: 'CHURCHILL' | 'EDUCATIVO',
  ahora: Date
): CsdVencimientoFila {
  const csd = csdEnv(prefix)
  if (!csd) {
    return {
      clave,
      empresa,
      rfc,
      vigenteDesde: null,
      vence: null,
      diasRestantes: null,
      alerta: 'sin_csd',
      mensaje: `Falta FACTUROPORTI_${prefix}_CSD en el entorno`,
    }
  }

  try {
    const { desde, hasta } = parsearCsd(csd)
    const dias = diasHastaVencimiento(hasta, ahora)
    return {
      clave,
      empresa,
      rfc,
      vigenteDesde: formatearFechaMx(desde),
      vence: formatearFechaMx(hasta),
      diasRestantes: dias,
      alerta: alertaPorDias(dias),
    }
  } catch (e) {
    return {
      clave,
      empresa,
      rfc,
      vigenteDesde: null,
      vence: null,
      diasRestantes: null,
      alerta: 'error',
      mensaje: e instanceof Error ? e.message : 'CSD inválido',
    }
  }
}

/** Lee los CSD de Vercel/env y calcula vigencia (sin exponer el certificado). */
export function listarVencimientosCsd(ahora = new Date()): CsdVencimientoFila[] {
  return [
    filaEmisor(
      'educativo',
      'Instituto Educativo Winston',
      CFDI_EMISOR_EDUCATIVO_RFC,
      'EDUCATIVO',
      ahora
    ),
    filaEmisor(
      'churchill',
      'Instituto Winston Churchill',
      CFDI_EMISOR_CHURCHILL_RFC,
      'CHURCHILL',
      ahora
    ),
  ]
}
