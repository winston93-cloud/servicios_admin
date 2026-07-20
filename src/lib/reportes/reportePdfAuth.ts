/**
 * Acceso temporal por clave compartida a reportes PDF externos.
 * Más adelante: login específico / sesión de staff.
 */
export const REPORTE_PDF_CLAVE = 'admin123'

/** Reportes que exigen la clave al abrirse por URL directa. */
export const REPORTES_CON_CLAVE = new Set(['insc-admin-dif2'])

export function reporteRequiereClave(slug: string): boolean {
  return REPORTES_CON_CLAVE.has(slug)
}

/**
 * Valida HTTP Basic Auth. Acepta cualquier usuario si la clave es la correcta
 * (p. ej. admin / admin123).
 */
export function autorizacionReportePdfValida(
  authorizationHeader: string | null
): boolean {
  if (!authorizationHeader?.startsWith('Basic ')) return false
  try {
    const decoded = atob(authorizationHeader.slice(6).trim())
    const sep = decoded.indexOf(':')
    const password = sep >= 0 ? decoded.slice(sep + 1) : decoded
    return password === REPORTE_PDF_CLAVE
  } catch {
    return false
  }
}

export function respuestaLoginReportePdf(): Response {
  return new Response('Autenticación requerida', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Reportes Inscripciones", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  })
}
