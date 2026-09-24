/** Orden personalizado del grid de módulos del dashboard (localStorage). */

const KEY_PREFIX = 'servicios-dashboard-nav-order:'

export function storageKeyOrdenDashboard(usuarioId: number): string {
  return `${KEY_PREFIX}${usuarioId}`
}

export function leerOrdenDashboard(usuarioId: number): string[] {
  if (!(usuarioId > 0) || typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKeyOrdenDashboard(usuarioId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((x) => String(x)).filter(Boolean)
  } catch {
    return []
  }
}

export function guardarOrdenDashboard(usuarioId: number, ids: string[]): void {
  if (!(usuarioId > 0) || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKeyOrdenDashboard(usuarioId), JSON.stringify(ids))
  } catch {
    /* quota / private mode */
  }
}

/** Aplica orden guardado; append ids nuevos; omite ids que ya no existen. */
export function aplicarOrdenDashboard<T extends { id: string }>(
  items: T[],
  ordenIds: string[]
): T[] {
  if (!items.length) return items
  if (!ordenIds.length) return items

  const byId = new Map(items.map((item) => [item.id, item]))
  const out: T[] = []
  const seen = new Set<string>()

  for (const id of ordenIds) {
    const item = byId.get(id)
    if (!item || seen.has(id)) continue
    out.push(item)
    seen.add(id)
  }

  for (const item of items) {
    if (seen.has(item.id)) continue
    out.push(item)
  }

  return out
}

export function moverEnLista<T>(lista: T[], from: number, to: number): T[] {
  if (from === to) return lista
  if (from < 0 || to < 0 || from >= lista.length || to >= lista.length) return lista
  const next = [...lista]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
