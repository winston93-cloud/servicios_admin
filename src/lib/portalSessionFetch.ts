import {
  portalSessionHeaderName,
  readPortalSessionForFetch,
} from '@/lib/insforgeDbProxyShared'

/** Cabecera de sesión del portal para APIs que exigen personal administrativo. */
export function portalSessionFetchHeaders(): Record<string, string> {
  const raw = readPortalSessionForFetch()
  if (!raw) return {}
  return { [portalSessionHeaderName()]: raw }
}
