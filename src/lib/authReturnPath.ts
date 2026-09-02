/**
 * Ruta relativa segura para volver tras login (?next=…).
 * Evita open-redirect (solo paths internos que empiezan con /).
 */
export function safeAuthReturnPath(raw: string | null | undefined): string | null {
  if (!raw) return null
  let path = raw.trim()
  try {
    path = decodeURIComponent(path)
  } catch {
    return null
  }
  if (!path.startsWith('/') || path.startsWith('//')) return null
  if (path.startsWith('/login')) return null
  return path
}

export function loginUrlWithReturn(returnPath: string): string {
  const safe = safeAuthReturnPath(returnPath)
  if (!safe) return '/login'
  return `/login?next=${encodeURIComponent(safe)}`
}
