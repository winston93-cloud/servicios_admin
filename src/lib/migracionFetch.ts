const TIMEOUT_MIGRACION_MS = 285_000

/** POST/GET migración con tope ~4m50s (Vercel Hobby = 300 s). */
export async function fetchMigracion(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MIGRACION_MS)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(
        'La petición superó ~5 minutos. Si es pago_detalle, espera y revisa Vercel Logs (200 = sigue); si falló, vuelve a migrar solo esa tabla.'
      )
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/** Parsea respuestas de las APIs de migración (Vercel a veces devuelve HTML/texto en timeout). */
export async function parsearRespuestaMigracion<T>(
  res: Response
): Promise<{ data: T; ok: boolean }> {
  if (res.status === 401) {
    throw new Error(
      'Secreto de migración inválido (401). Si usas MIGRACION_SECRET en Vercel, pégalo en el campo del panel.'
    )
  }
  const texto = await res.text()
  if (!texto.trim()) {
    throw new Error(
      res.status === 504 || res.status === 502
        ? `El servidor cortó la petición (${res.status}). La tabla puede ser muy grande: se reintentará por trozos si aplica.`
        : `Respuesta vacía del servidor (${res.status})`
    )
  }

  try {
    const data = JSON.parse(texto) as T
    return { data, ok: res.ok }
  } catch {
    const preview = texto.replace(/\s+/g, ' ').trim().slice(0, 160)
    if (
      res.status === 504 ||
      res.status === 502 ||
      preview.toLowerCase().includes('an error occurred')
    ) {
      throw new Error(
        'Tiempo agotado en Vercel (máx. 5 min por petición). Si la tabla es grande, actualiza el deploy y vuelve a migrar: ahora se procesa por trozos.'
      )
    }
    throw new Error(`Respuesta no válida (${res.status}): ${preview}`)
  }
}
