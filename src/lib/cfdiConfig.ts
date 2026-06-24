/** URL del portal PHP legacy (transición hasta Fase 5). */
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
