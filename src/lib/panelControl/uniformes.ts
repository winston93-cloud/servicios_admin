import { createDbAdmin } from '@/lib/insforgeAdmin'
import { estadoPorValor, type MedidorProceso, type PiezaMedida } from '@/lib/panelControl/tipos'

/** Banco de Uniformes (lo vigila Connor): mismo instrumento y escala que el resto del panel, lectura propia. */

type MetricasUniformes = {
  uso: {
    pedidos_hoy: number
    importe_hoy: number
    pedidos_7d: number
    pendientes: number
    movimientos_24h: number
    devoluciones_7d: number
    cotizaciones_7d: number
    transferencias_7d: number
    operaciones_24h: number
    ultima_operacion: string | null
  }
  stock: {
    negativos: number
    duplicados: number
    ubicaciones_desfasadas: number
    pedidos_incoherentes: number
    movimientos_24h: number
    movimientos_auditados_24h: number
    transferencias_abiertas: number
  }
  funciones: {
    esperadas: number
    presentes: number
    venta_esperadas: number
    venta_ejecutables: number
    internas: number
    internas_expuestas: number
    tablas_auditadas: number
  }
  enlace: {
    tablas_esperadas: number
    tablas_presentes: number
    ciclo_actual: number
    alumnos: number
    bucket: boolean
  }
  almacenamiento: {
    bytes_tablas: number
    bytes_auditoria: number
    bytes_base: number
    auditoria_filas: number
    auditoria_7d: number
    bucket_archivos: number
    bucket_bytes: number
  }
  /** Por tabla: [vivos, muertos, lecturas completas, lecturas por índice]. */
  tablas: Record<string, [number, number, number, number]>
}

export type KpiUniformes = { id: string; etiqueta: string; valor: string; detalle: string }

export type PanelUniformesRespuesta = {
  leidoEn: string
  kpis: KpiUniformes[]
  medidores: MedidorProceso[]
}

/** Tablas auditadas al migrar a Winston (19 oct 2026); menos significa que se perdió un trigger. */
const TABLAS_AUDITADAS = 32
const PRESUPUESTO_BASE_MS = 800
const TABLA_GRANDE = 10_000
const MB = 1024 * 1024
/** Espacio que se considera sano para Uniformes dentro de Winston Servicios. */
const PRESUPUESTO_TABLAS_MB = 1024
const PRESUPUESTO_BUCKET_MB = 1024
const VERCEL_PROYECTO_UNIFORMES = 'uniformes'
const VERCEL_EQUIPO = 'mario-alejandro-galvan-escobedos-projects'
const ESTADOS_SIRVIENDO = new Set(['READY', 'BUILDING', 'QUEUED', 'INITIALIZING'])

function pieza(base: Omit<PiezaMedida, 'estado' | 'corto'> & { corto?: string }): PiezaMedida {
  const estado = estadoPorValor(base.valor)
  const corto = estado === 'normal' ? 'bien' : estado === 'sin-dato' ? 'sin lectura' : base.corto ?? base.lectura
  return { ...base, estado, corto }
}

function proceso(id: string, nombre: string, mide: string, piezas: PiezaMedida[]): MedidorProceso {
  const valores = piezas.map((p) => p.valor).filter((v): v is number => typeof v === 'number')
  const valor = valores.length ? Math.min(...valores) : null
  const estado = estadoPorValor(valor)
  const debil = piezas.filter((p) => p.valor != null).sort((a, b) => (a.valor ?? 100) - (b.valor ?? 100))[0]
  const resumen =
    estado === 'sin-dato'
      ? 'Sin lectura todavía'
      : estado === 'normal' || !debil
        ? 'Todo bien'
        : `${debil.nombre}: ${debil.corto}`
  return { id, nombre, mide, valor, estado, piezas, resumen }
}

const num = (v: unknown) => Number(v) || 0
const mil = (n: number) => n.toLocaleString('es-MX')
const mb = (bytes: number) => `${(bytes / MB).toLocaleString('es-MX', { maximumFractionDigits: bytes < 10 * MB ? 1 : 0 })} MB`
const pesos = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
const seg = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`)

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** 100 hasta la mitad del presupuesto; baja en línea recta hasta 0 al llenarlo. */
function puntajeEspacio(usado: number, presupuesto: number): number {
  const pct = usado / presupuesto
  if (pct <= 0.5) return 100
  return Math.max(0, Math.round(100 - ((pct - 0.5) / 0.5) * 100))
}

function puntajeLatencia(ms: number, presupuesto: number): number {
  if (ms <= presupuesto) return 100
  return Math.max(0, Math.round(100 - ((ms - presupuesto) / (3 * presupuesto)) * 100))
}

// ── Vercel (solo lectura del tablero; nunca se le hace petición a la app) ──

let cacheApp: { en: number; estado: string | null } | null = null

async function estadoAppUniformes(): Promise<string | null | undefined> {
  const token = process.env.VERCEL_API_TOKEN?.trim()
  if (!token) return undefined
  if (cacheApp && Date.now() - cacheApp.en < 60_000) return cacheApp.estado
  const equipo = process.env.VERCEL_TEAM_SLUG?.trim() || VERCEL_EQUIPO
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${VERCEL_PROYECTO_UNIFORMES}?slug=${encodeURIComponent(equipo)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) },
  )
  if (!res.ok) throw new Error(`Vercel respondió ${res.status}`)
  const p = (await res.json()) as {
    targets?: { production?: { readyState?: string } }
    latestDeployments?: { target?: string | null; readyState?: string }[]
  }
  const estado =
    p.targets?.production?.readyState ?? p.latestDeployments?.find((d) => d.target === 'production')?.readyState ?? null
  cacheApp = { en: Date.now(), estado: estado ? estado.toUpperCase() : null }
  return cacheApp.estado
}

function estadoLegible(estado: string | null): string {
  switch (estado) {
    case 'READY':
      return 'listo'
    case 'ERROR':
      return 'con error'
    case 'BUILDING':
    case 'QUEUED':
    case 'INITIALIZING':
      return 'publicándose'
    case 'CANCELED':
      return 'cancelado'
    default:
      return 'no encontrado'
  }
}

// ── Lectura ──

let cacheLectura: { en: number; r: Promise<PanelUniformesRespuesta> } | null = null

export function leerPanelUniformes(): Promise<PanelUniformesRespuesta> {
  if (cacheLectura && Date.now() - cacheLectura.en < 30_000) return cacheLectura.r
  const r = leerSinCache()
  cacheLectura = { en: Date.now(), r }
  r.catch(() => {
    cacheLectura = null
  })
  return r
}

async function leerSinCache(): Promise<PanelUniformesRespuesta> {
  const rpcMedido = (async () => {
    const t = Date.now()
    const r = await createDbAdmin().rpc('panel_uniformes_metricas')
    return { r, ms: Date.now() - t }
  })()
  const [rpc, app] = await Promise.allSettled([rpcMedido, estadoAppUniformes()])

  let m: MetricasUniformes | null = null
  let msBase = 0
  let errorBase = 'Sin respuesta'
  if (rpc.status === 'fulfilled') {
    msBase = rpc.value.ms
    if (!rpc.value.r.error && rpc.value.r.data) m = rpc.value.r.data as MetricasUniformes
    else errorBase = rpc.value.r.error?.message ?? errorBase
  } else {
    errorBase = String((rpc.reason as Error)?.message ?? rpc.reason)
  }

  const piezaBase = m
    ? pieza({
        id: 'base',
        nombre: 'Respuesta de la base',
        valor: puntajeLatencia(msBase, PRESUPUESTO_BASE_MS),
        corto: `lenta (contesta en ${seg(msBase)})`,
        lectura: `contesta en ${seg(msBase)}`,
      })
    : pieza({ id: 'base', nombre: 'Respuesta de la base', valor: 0, lectura: 'no contesta', fallo: errorBase })

  const sinLectura = (id: string, nombre: string) => pieza({ id, nombre, valor: null, lectura: 'sin lectura' })

  // Uso
  const u = m?.uso
  const st = m?.stock
  const auditados = num(st?.movimientos_auditados_24h)
  const movs = num(st?.movimientos_24h)
  const uso = proceso('u-uso', 'Uso', 'Ventas, entregas y operaciones del sistema', u
    ? [
        pieza({
          id: 'hoy',
          nombre: 'Ventas de hoy',
          valor: 100,
          lectura: `${mil(num(u.pedidos_hoy))} ${num(u.pedidos_hoy) === 1 ? 'pedido' : 'pedidos'} por ${pesos(num(u.importe_hoy))}`,
        }),
        pieza({
          id: 'semana',
          nombre: 'Últimos 7 días',
          valor: 100,
          lectura: `${mil(num(u.pedidos_7d))} pedidos · ${mil(num(u.devoluciones_7d))} devoluciones · ${mil(num(u.cotizaciones_7d))} cotizaciones · ${mil(num(u.transferencias_7d))} transferencias`,
        }),
        pieza({
          id: 'pendientes',
          nombre: 'Pedidos por entregar',
          valor: 100,
          lectura: `${mil(num(u.pendientes))} pendientes de entrega`,
        }),
        pieza({
          id: 'bitacora',
          nombre: 'Bitácora de auditoría',
          valor: movs ? Math.round((Math.min(auditados, movs) / movs) * 100) : 100,
          corto: `${movs - auditados} movimientos sin registrar en la bitácora`,
          lectura: `${mil(num(u.operaciones_24h))} operaciones en 24 h${u.ultima_operacion ? ` · última ${horaLocal(u.ultima_operacion)}` : ''}`,
        }),
      ]
    : [sinLectura('hoy', 'Ventas de hoy'), sinLectura('bitacora', 'Bitácora de auditoría')])

  // Stock
  const stock = proceso('u-stock', 'Stock', 'Existencias, ubicaciones y pedidos coherentes', st
    ? [
        pieza({
          id: 'negativos',
          nombre: 'Stock negativo',
          valor: num(st.negativos) ? 0 : 100,
          corto: `${st.negativos} tallas con stock negativo`,
          lectura: num(st.negativos) ? `${st.negativos} tallas debajo de cero` : 'ninguna talla debajo de cero',
        }),
        pieza({
          id: 'duplicados',
          nombre: 'Tallas duplicadas',
          valor: num(st.duplicados) ? 0 : 100,
          corto: `${st.duplicados} tallas repetidas en una sucursal`,
          lectura: num(st.duplicados) ? `${st.duplicados} repetidas` : 'cada talla una sola vez por sucursal',
        }),
        pieza({
          id: 'pedidos',
          nombre: 'Pedidos coherentes',
          valor: Math.max(0, 100 - num(st.pedidos_incoherentes) * 20),
          corto: `${st.pedidos_incoherentes} pedidos con pendientes que no cuadran`,
          lectura: num(st.pedidos_incoherentes)
            ? `${st.pedidos_incoherentes} con estado y pendientes que no cuadran`
            : 'estado y pendientes cuadran en todos',
        }),
        pieza({
          id: 'ubicaciones',
          nombre: 'Ubicaciones',
          valor: Math.max(0, 100 - num(st.ubicaciones_desfasadas) * 5),
          corto: `${st.ubicaciones_desfasadas} tallas con ubicaciones que no suman su stock`,
          lectura: num(st.ubicaciones_desfasadas)
            ? `${st.ubicaciones_desfasadas} ${num(st.ubicaciones_desfasadas) === 1 ? 'talla no suma' : 'tallas no suman'} su stock en ubicaciones`
            : 'las ubicaciones suman el stock',
        }),
        pieza({
          id: 'transito',
          nombre: 'Transferencias en tránsito',
          valor: 100,
          lectura: num(st.transferencias_abiertas)
            ? `${st.transferencias_abiertas} sin recibir`
            : 'ninguna pendiente de recibir',
        }),
      ]
    : [sinLectura('negativos', 'Stock negativo')])

  // Funciones
  const f = m?.funciones
  const funciones = proceso('u-funciones', 'Funciones', 'Funciones de venta, transferencias y auditoría', f
    ? [
        pieza({
          id: 'presentes',
          nombre: 'Funciones del sistema',
          valor: num(f.presentes) >= num(f.esperadas) ? 100 : 0,
          corto: `faltan ${num(f.esperadas) - num(f.presentes)} funciones`,
          lectura: `${f.presentes} de ${f.esperadas} en la base`,
        }),
        pieza({
          id: 'venta',
          nombre: 'Venta y devolución',
          valor: num(f.venta_ejecutables) >= num(f.venta_esperadas) ? 100 : 0,
          corto: 'la app no puede ejecutar funciones de venta',
          lectura: `${f.venta_ejecutables} de ${f.venta_esperadas} disponibles para la app`,
        }),
        pieza({
          id: 'internas',
          nombre: 'Funciones internas',
          valor: num(f.internas_expuestas) ? 40 : 100,
          corto: `${f.internas_expuestas} funciones internas expuestas al público`,
          lectura: num(f.internas_expuestas)
            ? `${f.internas_expuestas} de ${f.internas} ejecutables desde fuera`
            : `${f.internas} protegidas (solo el sistema las usa)`,
        }),
        pieza({
          id: 'auditoria',
          nombre: 'Triggers de auditoría',
          valor: Math.min(100, Math.round((num(f.tablas_auditadas) / TABLAS_AUDITADAS) * 100)),
          corto: `${TABLAS_AUDITADAS - num(f.tablas_auditadas)} tablas dejaron de auditarse`,
          lectura: `${f.tablas_auditadas} tablas registran cada cambio`,
        }),
      ]
    : [sinLectura('presentes', 'Funciones del sistema')])

  // Eficiencia
  const tablas = Object.entries(m?.tablas ?? {}).map(([nombre, [vivos, muertos, completas, indice]]) => ({
    nombre,
    vivos: num(vivos),
    muertos: num(muertos),
    completas: num(completas),
    indice: num(indice),
  }))
  const grandes = tablas
    .filter((t) => t.vivos >= TABLA_GRANDE)
    .map((t) => ({ ...t, pct: Math.round((t.completas / Math.max(1, t.completas + t.indice)) * 100) }))
    .sort((a, b) => b.pct - a.pct)
  const floja = grandes[0]
  const conRegistros = tablas.filter((t) => t.vivos + t.muertos >= 1000)
  const sucia = conRegistros
    .map((t) => ({ ...t, pct: Math.round((t.muertos / Math.max(1, t.vivos + t.muertos)) * 100) }))
    .sort((a, b) => b.pct - a.pct)[0]
  const eficiencia = proceso('u-eficiencia', 'Eficiencia', 'Respuesta de la base, índices y limpieza', [
    piezaBase,
    !m
      ? sinLectura('indices', 'Índices')
      : floja
        ? pieza({
            id: 'indices',
            nombre: 'Índices',
            valor: Math.max(0, Math.min(100, 100 - Math.max(0, floja.pct - 10))),
            corto: `${floja.nombre} se lee completa el ${floja.pct}% de las veces`,
            lectura: `${grandes.map((t) => `${t.nombre} (${mil(t.vivos)}) por índice el ${100 - t.pct}%`).join(' · ')}`,
          })
        : pieza({ id: 'indices', nombre: 'Índices', valor: 100, lectura: 'tablas chicas: leerlas completas es rápido' }),
    !m
      ? sinLectura('limpieza', 'Limpieza')
      : sucia
        ? pieza({
            id: 'limpieza',
            nombre: 'Limpieza',
            valor: Math.max(0, Math.min(100, 100 - Math.max(0, sucia.pct - 20) * 2)),
            corto: `${sucia.nombre} con ${sucia.pct}% de registros muertos`,
            lectura: `${conRegistros.length} tablas al día (la más alta: ${sucia.nombre}, ${sucia.pct}% muertos)`,
          })
        : pieza({ id: 'limpieza', nombre: 'Limpieza', valor: 100, lectura: 'tablas chicas, nada que purgar' }),
  ])

  // Enlace
  const e = m?.enlace
  const estadoApp = app.status === 'fulfilled' ? app.value : undefined
  const piezaApp =
    app.status === 'rejected'
      ? pieza({ id: 'app', nombre: 'App en Vercel', valor: null, lectura: `Vercel no respondió: ${String((app.reason as Error)?.message ?? '')}` })
      : estadoApp === undefined
        ? pieza({ id: 'app', nombre: 'App en Vercel', valor: null, lectura: 'falta el token de lectura de Vercel' })
        : pieza({
            id: 'app',
            nombre: 'App en Vercel',
            valor: ESTADOS_SIRVIENDO.has(estadoApp ?? '') ? 100 : 0,
            corto: 'su deploy en producción no está listo',
            lectura: `uniformes-mu.vercel.app · deploy ${estadoLegible(estadoApp)}`,
          })
  const enlace = proceso('u-enlace', 'Enlace', 'App en Vercel, base Winston Servicios y datos compartidos', e
    ? [
        piezaApp,
        pieza({
          id: 'tablas',
          nombre: 'Tablas en Winston',
          valor: num(e.tablas_presentes) >= num(e.tablas_esperadas) ? 100 : 0,
          corto: `faltan ${num(e.tablas_esperadas) - num(e.tablas_presentes)} tablas`,
          lectura: `${e.tablas_presentes} de ${e.tablas_esperadas} tablas de Uniformes`,
        }),
        pieza({
          id: 'ciclo',
          nombre: 'Ciclo escolar',
          valor: num(e.ciclo_actual) === 1 ? 100 : num(e.ciclo_actual) > 1 ? 50 : 0,
          corto: num(e.ciclo_actual) ? `${e.ciclo_actual} ciclos marcados como actual` : 'no hay ciclo actual',
          lectura: 'ciclo actual compartido con Winston',
        }),
        pieza({
          id: 'alumnos',
          nombre: 'Alumnos de Winston',
          valor: num(e.alumnos) ? 100 : 0,
          corto: 'no se leen los alumnos',
          lectura: `${mil(num(e.alumnos))} alumnos disponibles para vender`,
        }),
        pieza({
          id: 'bucket',
          nombre: 'Storage fiscal',
          valor: e.bucket ? 100 : 0,
          corto: 'no existe el bucket de datos fiscales',
          lectura: 'bucket datos-fiscales-clientes',
        }),
      ]
    : [piezaApp])

  // Almacenamiento
  const a = m?.almacenamiento
  const filas = num(a?.auditoria_filas)
  const bytesPorFila = filas ? num(a?.bytes_auditoria) / filas : 0
  const auditoriaAnual = (num(a?.auditoria_7d) / 7) * 365 * bytesPorFila
  const almacenamiento = proceso('u-almacenamiento', 'Almacenamiento', 'Espacio de Uniformes en la base y en storage', a
    ? [
        pieza({
          id: 'tablas',
          nombre: 'Tablas',
          valor: puntajeEspacio(num(a.bytes_tablas) / MB, PRESUPUESTO_TABLAS_MB),
          corto: `${mb(num(a.bytes_tablas))} de ${PRESUPUESTO_TABLAS_MB} MB previstos`,
          lectura: `${mb(num(a.bytes_tablas))} · ${Math.round((num(a.bytes_tablas) / Math.max(1, num(a.bytes_base))) * 100)}% de la base Winston (${mb(num(a.bytes_base))})`,
        }),
        pieza({
          id: 'auditoria',
          nombre: 'Bitácora',
          valor: puntajeEspacio((num(a.bytes_auditoria) + auditoriaAnual) / MB, PRESUPUESTO_TABLAS_MB),
          corto: `crece ~${mb(auditoriaAnual)} al año`,
          lectura: `${mil(filas)} registros · ${mb(num(a.bytes_auditoria))} · ~${mil(Math.round(num(a.auditoria_7d) / 7))} al día (+${mb(auditoriaAnual)} al año)`,
        }),
        pieza({
          id: 'bucket',
          nombre: 'Archivos fiscales',
          valor: puntajeEspacio(num(a.bucket_bytes) / MB, PRESUPUESTO_BUCKET_MB),
          corto: `${mb(num(a.bucket_bytes))} en storage`,
          lectura: `${mil(num(a.bucket_archivos))} ${num(a.bucket_archivos) === 1 ? 'archivo' : 'archivos'} · ${mb(num(a.bucket_bytes))}`,
        }),
      ]
    : [sinLectura('tablas', 'Tablas')])

  const kpis: KpiUniformes[] = m
    ? [
        { id: 'ventas', etiqueta: 'Ventas hoy', valor: pesos(num(m.uso.importe_hoy)), detalle: `${mil(num(m.uso.pedidos_hoy))} pedidos` },
        { id: 'stock', etiqueta: 'Movimientos de stock', valor: mil(num(m.stock.movimientos_24h)), detalle: 'últimas 24 h' },
        { id: 'pendientes', etiqueta: 'Por entregar', valor: mil(num(m.uso.pendientes)), detalle: 'pedidos pendientes' },
        { id: 'espacio', etiqueta: 'Espacio en Winston', valor: mb(num(m.almacenamiento.bytes_tablas)), detalle: `${Math.round((num(m.almacenamiento.bytes_tablas) / Math.max(1, num(m.almacenamiento.bytes_base))) * 100)}% de la base` },
      ]
    : []

  return {
    leidoEn: new Date().toISOString(),
    kpis,
    medidores: [uso, stock, funciones, eficiencia, enlace, almacenamiento],
  }
}
