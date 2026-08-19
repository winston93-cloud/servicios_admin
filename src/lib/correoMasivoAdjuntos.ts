/** Límites y formato de adjuntos en correo masivo. */
export {
  CORREO_MASIVO_MAX_ARCHIVO_DIRECTO_BYTES,
  CORREO_MASIVO_MAX_TOTAL_BYTES,
} from '@/lib/correoMasivoAdjuntosStorage'

/** @deprecated Usar CORREO_MASIVO_MAX_ARCHIVO_DIRECTO_BYTES */
export const CORREO_MASIVO_MAX_ADJUNTOS_BYTES = 4 * 1024 * 1024

export function pesoTotalArchivos(archivos: File[]): number {
  return archivos.reduce((s, f) => s + (f.size || 0), 0)
}

export function formatearPesoBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** Envío directo en FormData (sin storage previo). */
export function debeUsarStorageAdjuntos(archivos: File[]): boolean {
  if (!archivos.length) return false
  const total = pesoTotalArchivos(archivos)
  return total > 3.5 * 1024 * 1024 || archivos.length > 1
}

export function validarPesoAdjuntosCorreoMasivo(archivos: File[]): string | null {
  if (!archivos.length) return null
  const total = pesoTotalArchivos(archivos)
  if (total > 24 * 1024 * 1024) {
    return `Los adjuntos pesan ${formatearPesoBytes(total)} (máx. ~24 MB por correo Gmail). Comprima los PDF.`
  }
  for (const f of archivos) {
    if (f.size > 3.5 * 1024 * 1024) {
      return `«${f.name}» pesa ${formatearPesoBytes(f.size)} (máx. ~3.5 MB por archivo). Comprímalo.`
    }
  }
  return null
}

export async function subirAdjuntosCorreoMasivo(
  archivos: File[],
  onProgreso?: (msg: string) => void
): Promise<string> {
  let token = ''
  for (let i = 0; i < archivos.length; i++) {
    const f = archivos[i]
    onProgreso?.(`Subiendo adjunto ${i + 1}/${archivos.length}: ${f.name}…`)
    const fd = new FormData()
    if (token) fd.set('token', token)
    fd.set('archivo', f)
    const res = await fetch('/api/correo-masivo/adjuntos', { method: 'POST', body: fd })
    const json = (await res.json()) as { error?: string; token?: string }
    if (!res.ok) {
      throw new Error(json.error ?? `No se pudo subir ${f.name}`)
    }
    token = String(json.token ?? token)
  }
  if (!token) throw new Error('No se generó token de adjuntos')
  return token
}
