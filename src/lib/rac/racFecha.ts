const FORMATO_MX = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Mexico_City',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * `YYYY-MM-DD` en hora de México para columnas TIMESTAMPTZ (p. ej. `reporte_registro`).
 * Recortar el ISO en UTC adelanta un día lo capturado después de las 18:00.
 */
export function fechaMxDeTimestamp(valor: unknown): string {
  const texto = String(valor ?? '').trim()
  if (!texto) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto
  const fecha = new Date(texto)
  if (Number.isNaN(fecha.getTime())) return texto.slice(0, 10)
  return FORMATO_MX.format(fecha)
}
