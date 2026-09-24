import { NAV_ITEMS_ADMIN } from '@/lib/dashboardNavAdmin'

/** usuario_id de Mario (sistemas.desarrollo) — espejo temporal al configurar otras cuentas. */
export const DASHBOARD_ESPEJO_USUARIO_ID = 17

/**
 * Cuentas con layout personalizado del dashboard:
 * grid de 5 columnas + botón «Cambiar orden».
 * laura (2), mario (17).
 */
export const DASHBOARD_LAYOUT_PERSONALIZADO_IDS = new Set<number>([2, 17])

export function dashboardLayoutPersonalizado(usuarioId: number | null | undefined): boolean {
  const uid = Number(usuarioId) || 0
  return uid > 0 && DASHBOARD_LAYOUT_PERSONALIZADO_IDS.has(uid)
}
/**
 * Cuentas de sistemas que no se configuran en este flujo
 * (Mario sí se usa como espejo; kevin se configura cuando Mario lo indique).
 */
export const DASHBOARD_SISTEMAS_PROTEGIDOS = new Set<number>([
  // vacío por ahora — kevin (6) se configura en este paso
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

const OCULTOS_KARLA_M = [
  'desayunos', // 1
  'prorrogas', // 4
  'devoluciones', // 5
  'checador', // 7
  'bajas', // 8
  'monitoreo', // 9
  'control-escolar', // 10
  'programa-usa', // 11
  'agenda-psicologas', // 12
  'agenda-directoras', // 13
  'facturacion', // 15
  'sat', // 17
  'cheques', // 18
  'contratos', // 19
  'boletas', // 20
  'becas', // 21
  'becarios', // 22
  'reportes-conducta', // 23
  'revision-pagados', // 25
] as const

/** coording / kinder_ing (dirección inglés kinder): oculta set previo de Fátima. */
const OCULTOS_COORDING_KINDER_ING = [
  'desayunos', // 1
  'devoluciones', // 5
  'checador', // 7
  'bajas', // 8
  'monitoreo', // 9
  'control-escolar', // 10
  'programa-usa', // 11
  'agenda-psicologas', // 12
  'agenda-directoras', // 13
  'open-house', // 14
  'facturacion', // 15
  'news-desayunos', // 16
  'sat', // 17
  'cheques', // 18
  'contratos', // 19
  'becas', // 21
  'becarios', // 22
  'revision-pagados', // 25
] as const

/**
 * Kevin: en el espejo previo (10 tarjetas visibles) Mario pidió quitar
 * 1,3,4,5,7,8,10 de esa numeración en pantalla → quedan Servicios, Programa USA y Becarios.
 */
const OCULTOS_KEVIN = [
  'desayunos', // 1
  'reportes', // 2
  'prorrogas', // 4
  'devoluciones', // 5
  'checador', // 7
  'bajas', // 8
  'monitoreo', // 9
  'control-escolar', // 10
  'agenda-psicologas', // 12
  'agenda-directoras', // 13
  'open-house', // 14
  'facturacion', // 15
  'news-desayunos', // 16
  'sat', // 17
  'cheques', // 18
  'contratos', // 19
  'boletas', // 20
  'becas', // 21
  'reportes-conducta', // 23
  'entregas-pie', // 24
  'revision-pagados', // 25
] as const

const OCULTOS_LAURA_VINCULACION = [
  'desayunos', // 1
  'prorrogas', // 4
  'devoluciones', // 5
  'checador', // 7
  'bajas', // 8
  'monitoreo', // 9
  'control-escolar', // 10
  'programa-usa', // 11
  'agenda-directoras', // 13
  'facturacion', // 15
  'sat', // 17
  'cheques', // 18
  'contratos', // 19
  'boletas', // 20
  'becarios', // 22
  'reportes-conducta', // 23
  'entregas-pie', // 24
  'revision-pagados', // 25
] as const

/** Enfermería: solo Servicios (#3). */
const OCULTOS_ENFERMERIA = [
  'desayunos', // 1
  'reportes', // 2
  'prorrogas', // 4
  'devoluciones', // 5
  'checador', // 7
  'bajas', // 8
  'monitoreo', // 9
  'control-escolar', // 10
  'programa-usa', // 11
  'agenda-psicologas', // 12
  'agenda-directoras', // 13
  'open-house', // 14
  'facturacion', // 15
  'news-desayunos', // 16
  'sat', // 17
  'cheques', // 18
  'contratos', // 19
  'boletas', // 20
  'becas', // 21
  'becarios', // 22
  'reportes-conducta', // 23
  'entregas-pie', // 24
  'revision-pagados', // 25
] as const

/** sara: Servicios + Desayunos + Monitoreo. */
const OCULTOS_SARA = [
  'reportes', // 2
  'prorrogas', // 4
  'devoluciones', // 5
  'checador', // 7
  'bajas', // 8
  'control-escolar', // 10
  'programa-usa', // 11
  'agenda-psicologas', // 12
  'agenda-directoras', // 13
  'open-house', // 14
  'facturacion', // 15
  'news-desayunos', // 16
  'sat', // 17
  'cheques', // 18
  'contratos', // 19
  'boletas', // 20
  'becas', // 21
  'becarios', // 22
  'reportes-conducta', // 23
  'entregas-pie', // 24
  'revision-pagados', // 25
] as const

/** coordprim, coordkin, josefina: oculta 1,7-12,14,15,17-19,22,24,25. */
const OCULTOS_COORD_JOSEFINA = [
  'desayunos', // 1
  'checador', // 7
  'bajas', // 8
  'monitoreo', // 9
  'control-escolar', // 10
  'programa-usa', // 11
  'agenda-psicologas', // 12
  'open-house', // 14
  'facturacion', // 15
  'sat', // 17
  'cheques', // 18
  'contratos', // 19
  'becarios', // 22
  'entregas-pie', // 24
  'revision-pagados', // 25
] as const

/** psicología (3 niveles): oculta 1,4,5,7,9-11,13,15-22,24. */
const OCULTOS_PSICOLOGIA = [
  'desayunos', // 1
  'prorrogas', // 4
  'devoluciones', // 5
  'checador', // 7
  'monitoreo', // 9
  'control-escolar', // 10
  'programa-usa', // 11
  'agenda-directoras', // 13
  'facturacion', // 15
  'news-desayunos', // 16
  'sat', // 17
  'cheques', // 18
  'contratos', // 19
  'boletas', // 20
  'becas', // 21
  'becarios', // 22
  'entregas-pie', // 24
] as const

/** Control escolar 3 niveles (fatima, controlprim, coordsec): oculta 1,4-7,9,12-15,17-19,22-24. */
const OCULTOS_CONTROL_ESCOLAR = [
  'desayunos', // 1
  'prorrogas', // 4
  'devoluciones', // 5
  'notificaciones', // 6 (ya no sale en dashboard; se mantiene por claridad)
  'checador', // 7
  'monitoreo', // 9
  'agenda-psicologas', // 12
  'agenda-directoras', // 13
  'open-house', // 14
  'facturacion', // 15
  'sat', // 17
  'cheques', // 18
  'contratos', // 19
  'becarios', // 22
  'reportes-conducta', // 23
  'entregas-pie', // 24
] as const

/** prefectura: mismo que CE + oculta 8,10,11. */
const OCULTOS_PREFECTURA = [
  ...OCULTOS_CONTROL_ESCOLAR,
  'bajas', // 8
  'control-escolar', // 10
  'programa-usa', // 11
] as const

/**
 * juanita: acceso solo a Desayunos, Reportes, Servicios, Monitoreo,
 * Control escolar, SAT y Cheques. (News y Revisión pagados: con * — no van aún.)
 */
const OCULTOS_JUANITA = [
  'prorrogas', // 4
  'devoluciones', // 5
  'notificaciones', // 6
  'checador', // 7
  'bajas', // 8
  'programa-usa', // 11
  'agenda-psicologas', // 12
  'agenda-directoras', // 13
  'open-house', // 14
  'facturacion', // 15
  'news-desayunos', // 16 *
  'contratos', // 19
  'boletas', // 20
  'becas', // 21
  'becarios', // 22
  'reportes-conducta', // 23
  'entregas-pie', // 24
  'revision-pagados', // 25 *
] as const

/**
 * Módulos OCULTOS por usuario_id.
 * Sin entrada (o arreglo vacío) = ve las 25 tarjetas.
 * Solo afecta visualización del dashboard empleado; no bloquea rutas.
 *
 * Espejo actual: Mario (17) = juanita.
 */
export const DASHBOARD_MODULOS_OCULTOS: Record<number, readonly string[]> = {
  1: OCULTOS_RUBEN_ALAN_CARLOS, // ruben
  37: OCULTOS_RUBEN_ALAN_CARLOS, // carlos
  38: OCULTOS_RUBEN_ALAN_CARLOS, // alan
  3: OCULTOS_KARLA_M, // karla_m
  10: OCULTOS_COORDING_KINDER_ING, // coording
  54: OCULTOS_COORDING_KINDER_ING, // kinder_ing (ex set visible de Fátima)
  6: OCULTOS_KEVIN, // kevin
  58: OCULTOS_LAURA_VINCULACION, // Laura Domínguez Vinculación
  40: OCULTOS_ENFERMERIA, // enfermeria
  7: OCULTOS_COORD_JOSEFINA, // coordprim
  8: OCULTOS_COORD_JOSEFINA, // coordkin
  13: OCULTOS_COORD_JOSEFINA, // josefina
  11: OCULTOS_PSICOLOGIA, // psicologia (primaria)
  55: OCULTOS_PSICOLOGIA, // psicologiak (maternal/kinder)
  56: OCULTOS_PSICOLOGIA, // psicologiasec (secundaria)
  39: OCULTOS_CONTROL_ESCOLAR, // fatima (CE kinder)
  16: OCULTOS_CONTROL_ESCOLAR, // controlprim (CE primaria)
  50: OCULTOS_CONTROL_ESCOLAR, // coordsec (CE secundaria)
  31: OCULTOS_PREFECTURA, // prefectura
  49: OCULTOS_ENFERMERIA, // estancia — solo Servicios
  57: OCULTOS_SARA, // sara — Desayunos, Servicios, Monitoreo
  52: OCULTOS_JUANITA, // juanita
  4: OCULTOS_RECEPCION, // recepcion1
  5: OCULTOS_RECEPCION, // recepcion2
  17: OCULTOS_RECEPCION, // mario — espejo recepción
}

export function modulosOcultosDeUsuario(usuarioId: number): Set<string> {
  const uid = Number(usuarioId)
  if (!(uid > 0)) return new Set()
  if (DASHBOARD_SISTEMAS_PROTEGIDOS.has(uid)) return new Set()
  const list = DASHBOARD_MODULOS_OCULTOS[uid]
  if (!list?.length) return new Set()
  return new Set(list)
}

export function filtrarNavItemsAdminPorUsuario<T extends { id: string; dashboardHidden?: boolean }>(
  items: T[],
  usuarioId: number | null | undefined
): T[] {
  const ocultos = modulosOcultosDeUsuario(Number(usuarioId) || 0)
  return items.filter((item) => {
    if (item.dashboardHidden) return false
    if (ocultos.size && ocultos.has(item.id)) return false
    return true
  })
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

/** Número estable del catálogo (1..25) para una tarjeta, o null si no está. */
export function numeroCatalogoDeModulo(moduleId: string): number | null {
  const found = DASHBOARD_MODULOS_CATALOGO.find((m) => m.id === moduleId)
  return found ? found.n : null
}
