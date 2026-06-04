/** Parsea respuestas de las APIs de migración (Vercel a veces devuelve HTML/texto en timeout). */
export async function parsearRespuestaMigracion<T>(
  res: Response
): Promise<{ data: T; ok: boolean }> {
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
