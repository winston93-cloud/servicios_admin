/** Lotes pequeños: InsForge devuelve 502 con IN grandes en tablas pesadas. */
export const CHUNK_ALUMNO_ID_PAGO = 40
export const CHUNK_ALUMNO_ID_GENERAL = 80
export const PAGE_ALUMNO = 500
export const PAGE_PAGO_INTERNO = 250

export function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}
