/**
 * Storage de cartas firmadas (bucket becas-documentos, prefijo cartas-firmadas/).
 */
import type { AppInsforgeClient } from '@/lib/dbTypes'

/** Reutiliza bucket existente de becas; no requiere bucket nuevo. */
export const BECAS_CARTAS_FIRMADAS_BUCKET = 'becas-documentos'

export function claveCartaFirmada(
  ciclo: number,
  alumnoId: number,
  autorizacionId: string
): string {
  return `cartas-firmadas/${ciclo}/${alumnoId}/${autorizacionId}.pdf`
}

export async function subirCartaFirmadaPdf(
  client: AppInsforgeClient,
  key: string,
  pdfBytes: Uint8Array
): Promise<{ key: string; url: string | null } | null> {
  const bucket = client.storage.from(BECAS_CARTAS_FIRMADAS_BUCKET)
  const copy = new Uint8Array(pdfBytes)
  const blob = new Blob([copy], { type: 'application/pdf' })

  await bucket.remove(key)

  const { data, error } = await bucket.upload(key, blob)
  if (error) {
    console.error('cartaFirmadaStorage upload:', error.message)
    return null
  }
  return { key: data?.key || key, url: data?.url ?? null }
}

export async function descargarCartaFirmadaPdf(
  client: AppInsforgeClient,
  key: string
): Promise<Uint8Array | null> {
  const { data, error } = await client.storage
    .from(BECAS_CARTAS_FIRMADAS_BUCKET)
    .download(key)
  if (error || !data) {
    console.error('cartaFirmadaStorage download:', error?.message)
    return null
  }
  const buf = await data.arrayBuffer()
  return new Uint8Array(buf)
}
