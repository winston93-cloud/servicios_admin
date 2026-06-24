/** Emisores CFDI (legacy cfdiwinston). */
export const CFDI_EMISOR_CHURCHILL_RFC = 'IWC990723LX1'
export const CFDI_EMISOR_EDUCATIVO_RFC = 'IEW150424CC2'

export function emisorRfcPorNivel(alumnoNivel: number): string {
  return alumnoNivel < 3 ? CFDI_EMISOR_EDUCATIVO_RFC : CFDI_EMISOR_CHURCHILL_RFC
}

/** URL base FacturoPorTi (producción). */
export function urlFacturoPorTiApi(): string {
  return (
    process.env.FACTUROPORTI_API_URL?.trim() ||
    'https://api.facturoporti.com.mx'
  ).replace(/\/$/, '')
}

/** Bearer PAC por emisor — solo servidor (Fase 3). */
export function bearerFacturoPorTi(emisor: 'churchill' | 'educativo'): string | null {
  const key =
    emisor === 'churchill'
      ? process.env.FACTUROPORTI_BEARER_CHURCHILL
      : process.env.FACTUROPORTI_BEARER_EDUCATIVO
  const v = key?.trim()
  return v || null
}

export function urlCfdiLegacyApp(): string {
  const explicit = process.env.NEXT_PUBLIC_CFDI_LEGACY_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  return 'https://www.winston93.edu.mx/cfdiwinston'
}

/** Reporte contadores legacy (fuera de cfdiwinston). */
export function urlReporteContadoresLegacy(): string {
  const explicit = process.env.NEXT_PUBLIC_CFDI_REPORTE_XML_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  return 'https://www.winston93.edu.mx/xml'
}
