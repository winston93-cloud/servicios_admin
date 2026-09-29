import { readPortalSessionForFetch, portalSessionHeaderName } from '@/lib/insforgeDbProxyShared'
import { ENLACES_X_PIN_HEADER } from '@/lib/enlacesX/enlacesXTypes'

export const CLAVE_PIN = 'enlaces-x-pin'

export type RespuestaAdmin<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string }

export async function fetchAdmin<T>(url: string, pin: string, init: RequestInit = {}): Promise<RespuestaAdmin<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', [ENLACES_X_PIN_HEADER]: pin }
  const sesion = readPortalSessionForFetch()
  if (sesion) headers[portalSessionHeaderName()] = sesion
  try {
    const res = await fetch(url, { ...init, headers, cache: 'no-store' })
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) return { ok: false, status: res.status, error: String(json.error ?? 'No se pudo completar la operación.') }
    return { ok: true, status: res.status, data: json as T }
  } catch {
    return { ok: false, status: 0, error: 'Sin conexión. Revisa tu internet e intenta de nuevo.' }
  }
}
