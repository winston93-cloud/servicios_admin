/** Límites y formato de adjuntos en correo masivo. */
export {
  CORREO_MASIVO_MAX_ARCHIVO_DIRECTO_BYTES,
  CORREO_MASIVO_MAX_ARCHIVO_GRANDE_BYTES,
  CORREO_MASIVO_MAX_TOTAL_BYTES,
  type EstrategiaSubidaInsforge,
} from '@/lib/correoMasivoAdjuntosStorage'

import type { EstrategiaSubidaInsforge } from '@/lib/correoMasivoAdjuntosStorage'

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

export function archivoRequiereSubidaDirectaInsforge(file: File): boolean {
  return file.size > 3.5 * 1024 * 1024
}

export function validarPesoAdjuntosCorreoMasivo(archivos: File[]): string | null {
  if (!archivos.length) return null
  const total = pesoTotalArchivos(archivos)
  if (total > 24 * 1024 * 1024) {
    return `Los adjuntos pesan ${formatearPesoBytes(total)} (máx. ~24 MB por correo Gmail). Comprima los PDF.`
  }
  for (const f of archivos) {
    if (f.size > 12 * 1024 * 1024) {
      return `«${f.name}» pesa ${formatearPesoBytes(f.size)} (máx. ~12 MB por archivo). Comprímalo.`
    }
  }
  return null
}

async function subirArchivoGrandeDirectoInsforge(
  file: File,
  token: string,
  onProgreso?: (msg: string) => void
): Promise<string> {
  onProgreso?.(`Preparando subida directa: ${file.name} (${formatearPesoBytes(file.size)})…`)
  const prepRes = await fetch('/api/correo-masivo/adjuntos/estrategia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: token || undefined,
      filename: file.name,
      size: file.size,
      contentType: file.type || 'application/octet-stream',
    }),
  })
  const prepJson = (await prepRes.json()) as {
    error?: string
    token?: string
    strategy?: EstrategiaSubidaInsforge
  }
  if (!prepRes.ok) {
    throw new Error(prepJson.error ?? `No se pudo preparar ${file.name}`)
  }

  const newToken = String(prepJson.token ?? token)
  const strategy = prepJson.strategy
  if (!strategy?.uploadUrl) {
    throw new Error(`Respuesta de subida inválida para ${file.name}`)
  }

  onProgreso?.(`Subiendo ${file.name} (${formatearPesoBytes(file.size)})…`)

  if (strategy.method === 'presigned') {
    const fd = new FormData()
    if (strategy.fields) {
      for (const [k, v] of Object.entries(strategy.fields)) {
        fd.append(k, String(v))
      }
    }
    fd.append('file', file)
    const up = await fetch(strategy.uploadUrl, { method: 'POST', body: fd })
    if (!up.ok) {
      throw new Error(`Error al subir ${file.name} al almacenamiento (${up.status})`)
    }
    if (strategy.confirmRequired && strategy.confirmUrl) {
      const confRes = await fetch('/api/correo-masivo/adjuntos/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmUrl: strategy.confirmUrl,
          size: file.size,
          contentType: file.type || 'application/octet-stream',
        }),
      })
      const confJson = (await confRes.json()) as { error?: string }
      if (!confRes.ok) {
        throw new Error(confJson.error ?? `No se pudo confirmar ${file.name}`)
      }
    }
    return newToken
  }

  if (strategy.method === 'direct') {
    const fd = new FormData()
    fd.append('file', file)
    const up = await fetch(strategy.uploadUrl, { method: 'PUT', body: fd })
    if (!up.ok) {
      throw new Error(`Error al subir ${file.name} (${up.status})`)
    }
    return newToken
  }

  throw new Error(`Método de subida no soportado para ${file.name}`)
}

export async function subirAdjuntosCorreoMasivo(
  archivos: File[],
  onProgreso?: (msg: string) => void
): Promise<string> {
  let token = ''
  for (let i = 0; i < archivos.length; i++) {
    const f = archivos[i]
    onProgreso?.(`Subiendo adjunto ${i + 1}/${archivos.length}: ${f.name}…`)
    if (archivoRequiereSubidaDirectaInsforge(f)) {
      token = await subirArchivoGrandeDirectoInsforge(f, token, onProgreso)
      continue
    }
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
