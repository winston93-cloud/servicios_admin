import {
  CFDI_EMISOR_CHURCHILL_RFC,
  CFDI_EMISOR_EDUCATIVO_RFC,
  bearerFacturoPorTi,
} from '../cfdiConfig'
import { CFDI_LOGO_CHURCHILL_BASE64, CFDI_LOGO_EDUCATIVO_BASE64 } from './cfdiLogosEmbedded'
import type { CfdiEmisorClave } from './cfdiTypes'

export function emisorClavePorNivel(alumnoNivel: number): CfdiEmisorClave {
  return alumnoNivel < 3 ? 'educativo' : 'churchill'
}

export function emisorClavePorRfc(rfc: string): CfdiEmisorClave | null {
  const n = rfc.trim().toUpperCase()
  if (n === CFDI_EMISOR_CHURCHILL_RFC) return 'churchill'
  if (n === CFDI_EMISOR_EDUCATIVO_RFC) return 'educativo'
  return null
}

function env(prefix: string, suffix: string): string {
  return process.env[`FACTUROPORTI_${prefix}_${suffix}`]?.trim() ?? ''
}

function logoEmbebido(clave: CfdiEmisorClave): string {
  return clave === 'churchill' ? CFDI_LOGO_CHURCHILL_BASE64 : CFDI_LOGO_EDUCATIVO_BASE64
}

/**
 * Logos FacturoPorTi (mismos PNG Banorte: escudo 200×200, educativo 84×76).
 * Prioridad: env (si es largo) → embebido en bundle (Vercel-safe, sin node:fs).
 */
function resolverLogoBase64(clave: CfdiEmisorClave, prefix: 'CHURCHILL' | 'EDUCATIVO'): string {
  const fromEnv = env(prefix, 'LOGO_BASE64')
  if (fromEnv.length > 100) return fromEnv
  return logoEmbebido(clave)
}

export interface CfdiEmisorPacConfig {
  clave: CfdiEmisorClave
  rfc: string
  razonSocial: string
  regimenFiscal: string
  serie: string
  lugarExpedicion: string
  calle: string
  numeroExterior: string
  colonia: string
  municipio: string
  estado: string
  codigoPostal: string
  csd: string
  llavePrivada: string
  csdPassword: string
  logoBase64: string
  bearer: string
  emailMensaje: string
}

export function obtenerConfigEmisor(clave: CfdiEmisorClave): CfdiEmisorPacConfig | null {
  const prefix = clave === 'churchill' ? 'CHURCHILL' : 'EDUCATIVO'
  const bearer = bearerFacturoPorTi(clave)
  const csd = env(prefix, 'CSD')
  const llavePrivada = env(prefix, 'KEY')
  const csdPassword = env(prefix, 'CSD_PASSWORD')

  if (!bearer || !csd || !llavePrivada || !csdPassword) {
    return null
  }

  if (clave === 'churchill') {
    return {
      clave,
      rfc: CFDI_EMISOR_CHURCHILL_RFC,
      razonSocial: 'INSTITUTO WINSTON CHURCHILL',
      regimenFiscal: '601',
      serie: env('CHURCHILL', 'SERIE') || 'IE',
      lugarExpedicion: '89440',
      calle: 'CALLE 3',
      numeroExterior: '309',
      colonia: 'JARDIN VEINTE DE NOVIEMBRE',
      municipio: 'CIUDAD MADERO',
      estado: 'TAMAULIPAS',
      codigoPostal: '89440',
      csd,
      llavePrivada,
      csdPassword,
      logoBase64: resolverLogoBase64('churchill', 'CHURCHILL'),
      bearer,
      emailMensaje: 'Envio de Factura Instituto Winston Churchill',
    }
  }

  return {
    clave,
    rfc: CFDI_EMISOR_EDUCATIVO_RFC,
    razonSocial: 'INSTITUTO EDUCATIVO WINSTON',
    regimenFiscal: '601',
    serie: env('EDUCATIVO', 'SERIE') || 'IE',
    lugarExpedicion: '89440',
    calle: '2',
    numeroExterior: '209',
    colonia: 'JARDIN VEINTE DE NOVIEMBRE',
    municipio: 'CIUDAD MADERO',
    estado: 'TAMAULIPAS',
    codigoPostal: '89440',
    csd,
    llavePrivada,
    csdPassword,
    logoBase64: resolverLogoBase64('educativo', 'EDUCATIVO'),
    bearer,
    emailMensaje: 'Envio de Factura',
  }
}
