import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'

export class ErrorTalleres extends Error {
  constructor(
    message: string,
    public status = 0,
    public advertencias?: string[]
  ) {
    super(message)
  }
}

const TIEMPO_MAX_MS = 20_000

function mensajeHttp(status: number): string {
  if (status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.'
  if (status === 403) return 'No tienes permiso para esta acción.'
  if (status === 404) return 'No se encontró la información. Recarga la página.'
  if (status >= 500) return 'El servidor no respondió bien. Intenta de nuevo en unos segundos.'
  return 'No se pudo completar la acción.'
}

/**
 * fetch + JSON con mensajes claros: sin conexión, tiempo agotado, respuestas que no son JSON (502 de Vercel).
 * `signal` externo permite cancelar (cambio de día, desmontaje); en ese caso lanza `AbortError`.
 */
export async function fetchTalleres<T>(
  url: string,
  init: RequestInit & { json?: unknown } = {},
  signal?: AbortSignal
): Promise<T> {
  const ctrl = new AbortController()
  let agotado = false
  const timer = window.setTimeout(() => {
    agotado = true
    ctrl.abort()
  }, TIEMPO_MAX_MS)
  const reenviar = () => ctrl.abort()
  signal?.addEventListener('abort', reenviar)
  const { json, headers, ...resto } = init
  try {
    let res: Response
    try {
      res = await fetch(url, {
        cache: 'no-store',
        ...resto,
        headers: {
          ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...portalSessionFetchHeaders(),
          ...(headers as Record<string, string> | undefined),
        },
        body: json !== undefined ? JSON.stringify(json) : resto.body,
        signal: ctrl.signal,
      })
    } catch (e) {
      if (signal?.aborted) throw e
      if (agotado) throw new ErrorTalleres('La conexión está tardando demasiado. Revisa tu señal e intenta de nuevo.')
      throw new ErrorTalleres(
        typeof navigator !== 'undefined' && navigator.onLine === false
          ? 'Sin conexión a internet. Revisa tu señal e intenta de nuevo.'
          : 'No se pudo conectar con el servidor. Revisa tu señal e intenta de nuevo.'
      )
    }
    const datos = (await res.json().catch(() => null)) as (T & { error?: string; advertencias?: string[] }) | null
    if (!res.ok) {
      throw new ErrorTalleres(datos?.error || mensajeHttp(res.status), res.status, datos?.advertencias)
    }
    if (datos == null) throw new ErrorTalleres(mensajeHttp(500), res.status)
    return datos
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', reenviar)
  }
}

export function esCancelacion(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

export function mensajeDe(e: unknown, respaldo = 'Ocurrió un error.'): string {
  return e instanceof Error && e.message ? e.message : respaldo
}
