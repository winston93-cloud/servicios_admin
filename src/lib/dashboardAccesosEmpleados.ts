import { NAV_ITEMS_ADMIN } from '@/lib/dashboardNavAdmin'

/** usuario_id de Mario (sistemas.desarrollo) — espejo temporal al configurar otra cuenta. */
export const DASHBOARD_ESPEJO_USUARIO_ID = 17

/**
 * Cuentas de sistemas en producción: NUNCA se les quitan tarjetas
 * (salvo el espejo temporal de Mario mientras se configura otra cuenta).
 */
export const DASHBOARD_SISTEMAS_PROTEGIDOS = new Set<number>([
  6, // kevin
  37, // carlos
  38, // alan
])

/** Catálogo numerado 1..25 para el flujo de configuración con Mario. */
export const DASHBOARD_MODULOS_CATALOGO = NAV_ITEMS_ADMIN.map((item, idx) => ({
  n: idx + 1,
  id: item.id,
  label: item.label,
}))

/**
 * Módulos OCULTOS por usuario_id.
 * Sin entrada (o arreglo vacío) = ve las 25 tarjetas.
 * Solo afecta visualización del dashboard empleado; no bloquea rutas.
 */
export const DASHBOARD_MODULOS_OCULTOS: Record<number, readonly string[]> = {
  // Se irá llenando cuenta por cuenta (ruben, laura, …).
  // Mario (17) solo se usa como espejo temporal; al final queda [] / sin entrada.
}

export function modulosOcultosDeUsuario(usuarioId: number): Set<string> {
  const uid = Number(usuarioId)
  if (!(uid > 0)) return new Set()
  if (DASHBOARD_SISTEMAS_PROTEGIDOS.has(uid)) return new Set()
  const list = DASHBOARD_MODULOS_OCULTOS[uid]
  if (!list?.length) return new Set()
  return new Set(list)
}

export function filtrarNavItemsAdminPorUsuario<T extends { id: string }>(
  items: T[],
  usuarioId: number | null | undefined
): T[] {
  const ocultos = modulosOcultosDeUsuario(Number(usuarioId) || 0)
  if (!ocultos.size) return items
  return items.filter((item) => !ocultos.has(item.id))
}

/** Resuelve números 1..25 → ids de módulo. */
export function idsDesdeNumerosCatalogo(nums: number[]): string[] {
  const byN = new Map(DASHBOARD_MODULOS_CATALOGO.map((m) => [m.n, m.id]))
  const out: string[] = []
  const seen = new Set<string>()
  for (const n of nums) {
    const id = byN.get(Number(n))
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}
