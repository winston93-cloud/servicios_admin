/** Límite práctico de cuerpo en Vercel (serverless). Dejar margen bajo 4.5 MB. */
export const CORREO_MASIVO_MAX_ADJUNTOS_BYTES = 4 * 1024 * 1024

export function pesoTotalArchivos(archivos: File[]): number {
  return archivos.reduce((s, f) => s + (f.size || 0), 0)
}

export function formatearPesoBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function validarPesoAdjuntosCorreoMasivo(archivos: File[]): string | null {
  if (!archivos.length) return null
  const total = pesoTotalArchivos(archivos)
  if (total <= CORREO_MASIVO_MAX_ADJUNTOS_BYTES) return null
  return `Los adjuntos pesan ${formatearPesoBytes(total)} (máx. ~${formatearPesoBytes(CORREO_MASIVO_MAX_ADJUNTOS_BYTES)} por envío). Comprima los PDF o envíe menos archivos por correo.`
}
