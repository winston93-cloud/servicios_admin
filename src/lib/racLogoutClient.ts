/**
 * Limpia el estado de Google Identity Services en el cliente
 * (evita que en PCs compartidas se reabra la cuenta anterior).
 */
export function limpiarSesionGoogleCliente() {
  if (typeof window === 'undefined') return
  try {
    window.google?.accounts?.id?.disableAutoSelect?.()
  } catch {
    /* ignore */
  }
  try {
    window.google?.accounts?.id?.cancel?.()
  } catch {
    /* ignore */
  }
}
