/** Mensaje seguro para UI: no filtrar HTML de proxies (502 OpenResty, etc.). */
export function mensajeErrorPublico(err: unknown, fallback = 'Error del servidor'): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const t = raw.trim()
  if (!t) return fallback
  if (
    /<\s*html|bad gateway|502|503|504|openresty|cloudflare|gateway timeout|nginx/i.test(t)
  ) {
    return 'El servicio de datos no respondió (error temporal). Espera unos segundos y pulsa Actualizar.'
  }
  if (/network request failed|fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(t)) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.'
  }
  if (t.length > 280) return fallback
  return t
}

export function statusHttpDesdeError(err: unknown, fallback = 500): number {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  if (/502|bad gateway/i.test(raw)) return 502
  if (/503|service unavailable/i.test(raw)) return 503
  if (/504|gateway timeout/i.test(raw)) return 504
  return fallback
}
