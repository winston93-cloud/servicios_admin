import { NAV_ITEMS_ADMIN } from '@/lib/dashboardNavAdmin'

/** usuario_id de Mario (sistemas.desarrollo) — espejo temporal al configurar otras cuentas. */
export const DASHBOARD_ESPEJO_USUARIO_ID = 17

/**
 * Cuentas de sistemas que no se configuran en este flujo
 * (Mario sí se usa como espejo).
 */
export const DASHBOARD_SISTEMAS_PROTEGIDOS = new Set<number>([
  6, // kevin — no tocar salvo indicación explícita
])

/** Catálogo numerado 1..25 para el flujo de configuración con Mario. */
export const DASHBOARD_MODULOS_CATALOGO = NAV_ITEMS_ADMIN.map((item, idx) => ({
  n: idx + 1,
  id: item.id,
  label: item.label,
}))

const OCULTOS_RUBEN_ALAN_CARLOS = [
  'desayunos', // 1
  'devoluciones', // 5
  'bajas', // 8
  'monitoreo', // 9
  'control-escolar', // 10
  'programa-usa', // 11
  'agenda-psicologas', // 12
  'agenda-directoras', // 13
  'open-house', // 14
  'sat', // 17
  'cheques', // 18
  'contratos', // 19
  'boletas', // 20
  'becas', // 21
  'becarios', // 22
  'reportes-conducta', // 23
  'revision-pagados', // 25
] as const

/**
 * Módulos OCULTOS por usuario_id.
 * Sin entrada (o arreglo vacío) = ve las 25 tarjetas.
 * Solo afecta visualización del dashboard empleado; no bloquea rutas.
 *
 * Espejo actual: Mario (17) = mismo set que ruben/alan/carlos.
 */
export const DASHBOARD_MODULOS_OCULTOS: Record<number, readonly string[]> = {
  1: OCULTOS_RUBEN_ALAN_CARLOS, // ruben
  37: OCULTOS_RUBEN_ALAN_CARLOS, // carlos
  38: OCULTOS_RUBEN_ALAN_CARLOS, // alan
  17: OCULTOS_RUBEN_ALAN_CARLOS, // mario — espejo
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
