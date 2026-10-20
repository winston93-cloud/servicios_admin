import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  estadoPorValor,
  type MedidorProceso,
  type PanelControlRespuesta,
  type PiezaMedida,
} from '@/lib/panelControl/tipos'
import type { PiezaSonda, TareaLatido } from '@/lib/panelControl/sonda'

type EventosPieza = {
  ops: number
  fallos: number
  ms_prom: number | null
  ms_p95: number | null
  ultimo: string | null
  ultimo_fallo: string | null
}

type Latido = { ultimo_intento: string; ultimo_ok: string | null; ok: boolean; ms: number; detalle: string | null }

type Metricas = {
  piezas: Partial<Record<PiezaSonda, EventosPieza>>
  openpay_webhook: { ops: number; fallos: number; ultimo: string | null; ultimo_fallo: string | null }
  latidos: Partial<Record<TareaLatido, Latido>>
  kommo: { registros: number; con_lead: number; recordatorios_atrasados: number; recordatorios_enviados_7d: number } | null
  base: { conexiones: number; max_conexiones: number; bytes: number }
  /** Por tabla: [vivos, muertos, lecturas completas, lecturas por índice] (solo tablas de 1 000 registros o más). */
  tablas?: Record<string, [number, number, number, number]>
}

/**
 * Apps de producción cuyo estado se lee de la API de Vercel (nunca se les hace petición).
 * Fuera: las de prueba y el portal de Desayunos (`services`, apagado a propósito).
 */
const APPS_PRODUCCION: { nombre: string; url: string }[] = [
  { nombre: 'Servicios Admin', url: 'https://servicios.winston93.edu.mx/login' },
  { nombre: 'Uniformes', url: 'https://uniformes-mu.vercel.app' },
  { nombre: 'Reloj checador', url: 'https://winston-registro.vercel.app' },
  { nombre: 'Becas renovación', url: 'https://becas-renovacion.vercel.app' },
  { nombre: 'Winston USA Program', url: 'https://winston-usa-program.vercel.app' },
  { nombre: 'AgendaW', url: 'https://agendaw.vercel.app' },
  { nombre: 'Open House', url: 'https://open-house-chi.vercel.app' },
  { nombre: 'Cheques', url: 'https://cheques-new.vercel.app' },
  { nombre: 'Caja chica', url: 'https://cchic.vercel.app' },
  { nombre: 'SSIW', url: 'https://ssiw.vercel.app' },
  { nombre: 'Contratos', url: 'https://contratos-chi.vercel.app' },
  { nombre: 'Prórrogas y ajustes', url: 'https://prorrogas-ajustes.vercel.app' },
]

/** Tiempo aceptable (p95 de operaciones reales) por pieza, en ms. El correo incluye la espera del límite de Gmail. */
const PRESUPUESTO_MS: Record<PiezaSonda, number> = {
  banorte: 8000,
  'openpay-api': 4000,
  pac: 8000,
  'storage-cfdi': 3000,
  correo: 15000,
  'google-calendar': 4000,
}
const PRESUPUESTO_BASE_MS = 800

/** Conexiones: hasta 90% en uso es normal; arriba de 90 entra en precaución y desde ~95 en alarma. */
const CONEXIONES_LIMITE = 90

function valorConexiones(uso: number): number {
  if (uso <= CONEXIONES_LIMITE) return 100
  return Math.max(0, Math.round(89 - (uso - CONEXIONES_LIMITE) * 6))
}

/** Horario de las tareas de vercel.json, en UTC. */
const TAREAS: Record<TareaLatido, { nombre: string; horaUtc: number; dias: number[] }> = {
  'cron-talleres-minimo': { nombre: 'Tarea de las 8:00 (talleres)', horaUtc: 14, dias: [1, 2, 3, 4, 5] },
  'cron-recordatorio-liberacion-docs': { nombre: 'Tarea de las 9:00 (control escolar)', horaUtc: 15, dias: [0, 1, 2, 3, 4, 5, 6] },
}

/** Los 10 sistemas que más usan la base Winston Servicios (medido el 20 oct 2026; Uniformes es de Connor). */
const SISTEMAS: { id: string; nombre: string; mide: string; app?: string; tablas: RegExp }[] = [
  {
    id: 'control-escolar',
    nombre: 'Control escolar',
    mide: 'Alumnos, familias, contactos y expedientes',
    app: 'Servicios Admin',
    tablas: /^(alumno|alumno_familiar|alumno_contacto|alumno_contacto_auditoria|alumno_detalles|alumno_dato_medico|alumno_situacion_delicada|alumno_foto|alumno_caso_especial|alumno_cambio_ciclo_respaldo|ce_tramite_administrativo|reporte_suspension|suspension_envio_log)$/,
  },
  { id: 'boletas', nombre: 'Boletas', mide: 'Captura, promedios y publicación de boletas', app: 'Servicios Admin', tablas: /^(boleta_.*|promedio_ciclo)$/ },
  {
    id: 'caja',
    nombre: 'Caja de servicios',
    mide: 'Cobros internos y vouchers',
    app: 'Servicios Admin',
    tablas: /^(pago_interno.*|concepto_interno|pago_boucher_precio|concepto_boucher|alumno_cargo_extra)$/,
  },
  {
    id: 'becas',
    nombre: 'Becas',
    mide: 'Renovaciones, solicitudes, documentos y firmas',
    app: 'Becas renovación',
    tablas: /^(becas_.*|alumno_beca.*|concepto_beca|becario_bitacora)$/,
  },
  {
    id: 'acceso',
    nombre: 'Control de acceso',
    mide: 'Entradas con QR y autorizaciones',
    app: 'Reloj checador',
    tablas: /^(control_acceso_dia|acceso_autorizado.*|autorizacion_entrada)$/,
  },
  {
    id: 'workshops',
    nombre: 'Workshops',
    mide: 'Sesiones, asistencia, jueces y evaluaciones',
    tablas: /^(workshop_.*|academic_workshops|judges|participants|teams|evaluation_scores|judge_rubric_documents|presentaciones)$/,
  },
  { id: 'ssiw', nombre: 'SSIW', mide: 'Entrega de alumnos y salida a pie', app: 'SSIW', tablas: /^(entregas_alumnos|registro_salida_pie)$/ },
  { id: 'cheques', nombre: 'Cheques', mide: 'Cheques, beneficiarios y conceptos', app: 'Cheques', tablas: /^(ch_.*|cheques_banco)$/ },
  { id: 'prorrogas', nombre: 'Prórrogas', mide: 'Prórrogas y ajustes de pago', app: 'Prórrogas y ajustes', tablas: /^pago_prorroga$/ },
  {
    id: 'portal-inscripcion',
    nombre: 'Portal de inscripción',
    mide: 'Inscripción en línea, documentos y avisos',
    app: 'Servicios Admin',
    tablas: /^(portal_(?!news).*|a_inscritos|iwc_gral_ins|inscripcion_alerta_sin_pago)$/,
  },
]

/** Debajo de esto leer la tabla completa es rápido y no se califica el uso de índices. */
const TABLA_GRANDE = 10_000

const VERCEL_PROYECTO = 'servicios-admin'
const VERCEL_EQUIPO = 'mario-alejandro-galvan-escobedos-projects'

// ── Lecturas (solo pasivas: nada de peticiones a las pasarelas, al PAC, a Gmail ni a las apps) ──

type EstadoApp = { nombre: string; estado: string | null }

function tokenVercel(): string | null {
  return process.env.VERCEL_API_TOKEN?.trim() || null
}

function equipoVercel(): string {
  return process.env.VERCEL_TEAM_SLUG?.trim() || VERCEL_EQUIPO
}

let cacheApps: { en: number; datos: EstadoApp[] } | null = null

/** Estado del deploy de producción de cada app según la API de Vercel (solo lectura del tablero de Vercel). */
async function estadoApps(): Promise<EstadoApp[] | null> {
  const token = tokenVercel()
  if (!token) return null
  if (cacheApps && Date.now() - cacheApps.en < 60_000) return cacheApps.datos
  const res = await fetch(`https://api.vercel.com/v9/projects?limit=100&slug=${encodeURIComponent(equipoVercel())}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Vercel respondió ${res.status}`)
  const json = (await res.json()) as {
    projects?: {
      targets?: { production?: { alias?: string[]; readyState?: string } }
      latestDeployments?: { target?: string | null; readyState?: string; alias?: string[] }[]
    }[]
  }
  const proyectos = json.projects ?? []
  const datos = APPS_PRODUCCION.map(({ nombre, url }) => {
    const host = new URL(url).host
    const p = proyectos.find(
      (x) =>
        x.targets?.production?.alias?.includes(host) ||
        x.latestDeployments?.some((d) => d.target === 'production' && d.alias?.includes(host))
    )
    const estado =
      p?.targets?.production?.readyState ??
      p?.latestDeployments?.find((d) => d.target === 'production')?.readyState ??
      null
    return { nombre, estado: estado ? estado.toUpperCase() : null }
  })
  cacheApps = { en: Date.now(), datos }
  return datos
}

type DeploysVercel = { total: number; listos: number; error: number; ultimo: { en: number; estado: string } | null }

let cacheDeploys: { en: number; datos: DeploysVercel } | null = null

async function deploysVercel(): Promise<DeploysVercel | null> {
  const token = tokenVercel()
  if (!token) return null
  if (cacheDeploys && Date.now() - cacheDeploys.en < 60_000) return cacheDeploys.datos
  const params = new URLSearchParams({
    app: VERCEL_PROYECTO,
    target: 'production',
    since: String(Date.now() - 7 * 24 * 3600 * 1000),
    limit: '100',
    slug: equipoVercel(),
  })
  const res = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Vercel respondió ${res.status}`)
  const json = (await res.json()) as {
    deployments?: { state?: string; readyState?: string; created?: number; createdAt?: number }[]
  }
  const lista = (json.deployments ?? []).map((d) => ({
    estado: String(d.state ?? d.readyState ?? '').toUpperCase(),
    en: Number(d.created ?? d.createdAt ?? 0),
  }))
  const datos: DeploysVercel = {
    total: lista.length,
    listos: lista.filter((d) => d.estado === 'READY').length,
    error: lista.filter((d) => d.estado === 'ERROR').length,
    ultimo: lista.sort((a, b) => b.en - a.en)[0] ?? null,
  }
  cacheDeploys = { en: Date.now(), datos }
  return datos
}

// ── Calificación ──

/** 100 dentro del presupuesto; baja en línea recta hasta 0 al cuádruple. */
function puntajeLatencia(ms: number, presupuesto: number): number {
  if (ms <= presupuesto) return 100
  return Math.max(0, Math.round(100 - ((ms - presupuesto) / (3 * presupuesto)) * 100))
}

/** 2.5 % de fallos ya es precaución; 10 % es alarma. */
function puntajeFallos(fallos: number, ops: number): number {
  if (!ops) return 100
  return Math.max(0, Math.round(100 - (fallos / ops) * 100 * 4))
}

function minimo(...valores: (number | null | undefined)[]): number | null {
  const v = valores.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
  return v.length ? Math.min(...v) : null
}

function fallosDe(fallos: number, ops: number): string {
  return `${fallos} ${fallos === 1 ? 'fallo' : 'fallos'} de ${ops} en 24 h`
}

function seg(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`
}

function pieza(base: Omit<PiezaMedida, 'estado' | 'corto'> & { corto?: string }): PiezaMedida {
  const estado = estadoPorValor(base.valor)
  const corto = estado === 'normal' ? 'bien' : estado === 'sin-dato' ? 'sin lectura' : base.corto ?? base.lectura
  return { ...base, estado, corto }
}

type Causa = { valor: number; corto: string }

function peorCausa(causas: (Causa | null)[]): Causa | null {
  const v = causas.filter((c): c is Causa => c != null)
  return v.length ? v.reduce((a, b) => (b.valor < a.valor ? b : a)) : null
}

/** Pieza medida solo con sus operaciones reales de las últimas 24 h. */
function piezaServicio(id: string, nombre: string, ev: EventosPieza | undefined, presupuesto: number): PiezaMedida {
  const ops = Number(ev?.ops ?? 0)
  const fallos = Number(ev?.fallos ?? 0)
  const p95 = ev?.ms_p95 != null ? Number(ev.ms_p95) : null
  const causa = peorCausa([
    ops ? { valor: puntajeFallos(fallos, ops), corto: `${Math.round((fallos / ops) * 100)}% de operaciones fallan` } : null,
    ops && p95 != null ? { valor: puntajeLatencia(p95, presupuesto), corto: `lento (tarda hasta ${seg(p95)})` } : null,
  ])
  const lectura = ops ? `${fallosDe(fallos, ops)}${p95 != null ? ` · tarda hasta ${seg(p95)}` : ''}` : 'sin operaciones en 24 h'
  return pieza({
    id,
    nombre,
    valor: causa?.valor ?? null,
    corto: causa?.corto,
    lectura,
    fallo: fallos ? ev?.ultimo_fallo ?? undefined : undefined,
  })
}

function ultimaEjecucionEsperada(horaUtc: number, dias: number[], ahora = new Date()): Date {
  for (let d = 0; d < 8; d++) {
    const c = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() - d, horaUtc))
    if (c <= ahora && dias.includes(c.getUTCDay())) return c
  }
  return new Date(ahora.getTime() - 8 * 24 * 3600 * 1000)
}

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: 'America/Monterrey',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function piezaLatido(tarea: TareaLatido, l: Latido | undefined): PiezaMedida {
  const { nombre, horaUtc, dias } = TAREAS[tarea]
  if (!l) return pieza({ id: tarea, nombre, valor: null, lectura: 'sin latido todavía (empieza en su siguiente corrida)' })
  const esperada = ultimaEjecucionEsperada(horaUtc, dias)
  const margen = 20 * 60 * 1000
  const intento = new Date(l.ultimo_intento).getTime()
  const ultimoOk = l.ultimo_ok ? new Date(l.ultimo_ok).getTime() : 0
  if (intento >= esperada.getTime() - margen && !l.ok) {
    return pieza({ id: tarea, nombre, valor: 0, corto: 'falló en su última corrida', lectura: `falló ${horaLocal(l.ultimo_intento)}`, fallo: l.detalle ?? undefined })
  }
  if (ultimoOk < esperada.getTime() - margen && Date.now() > esperada.getTime() + margen) {
    return pieza({
      id: tarea,
      nombre,
      valor: 0,
      corto: 'no corrió a su hora',
      lectura: `no corrió a su hora · último ok ${l.ultimo_ok ? horaLocal(l.ultimo_ok) : 'nunca'}`,
    })
  }
  return pieza({ id: tarea, nombre, valor: 100, lectura: `corrió ${horaLocal(l.ultimo_ok ?? l.ultimo_intento)} en ${seg(l.ms)}` })
}

/** Con un deploy publicándose, producción sigue sirviendo el anterior. */
const ESTADOS_SIRVIENDO = new Set(['READY', 'BUILDING', 'QUEUED', 'INITIALIZING'])

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

function proceso(id: string, nombre: string, mide: string, piezas: PiezaMedida[]): MedidorProceso {
  const valor = minimo(...piezas.map((p) => p.valor))
  const estado = estadoPorValor(valor)
  const debil = piezas
    .filter((p) => p.valor != null)
    .sort((a, b) => (a.valor ?? 100) - (b.valor ?? 100))[0]
  const resumen =
    estado === 'sin-dato'
      ? 'Sin lectura todavía'
      : estado === 'normal' || !debil
        ? 'Todo bien'
        : `${debil.nombre.replace(/\s*\(.*\)$/, '')}: ${debil.corto}`
  return { id, nombre, mide, valor, estado, piezas, resumen }
}

type Tabla = { nombre: string; vivos: number; muertos: number; completas: number; indice: number }

function tablasDe(m: Metricas | null, rx: RegExp): Tabla[] {
  return Object.entries(m?.tablas ?? {})
    .filter(([nombre]) => rx.test(nombre))
    .map(([nombre, [vivos, muertos, completas, indice]]) => ({
      nombre,
      vivos: Number(vivos) || 0,
      muertos: Number(muertos) || 0,
      completas: Number(completas) || 0,
      indice: Number(indice) || 0,
    }))
}

/** Tablas grandes que se leen completas en vez de por índice: tornillo flojo que vuelve lento al sistema. */
function piezaIndices(m: Metricas | null, tablas: Tabla[]): PiezaMedida {
  if (!m?.tablas) return pieza({ id: 'indices', nombre: 'Índices', valor: null, lectura: 'sin lectura' })
  const grandes = tablas
    .filter((t) => t.vivos >= TABLA_GRANDE)
    .map((t) => ({ ...t, pct: Math.round((t.completas / Math.max(1, t.completas + t.indice)) * 100) }))
    .sort((a, b) => b.pct - a.pct)
  if (!grandes.length) {
    return pieza({ id: 'indices', nombre: 'Índices', valor: 100, lectura: 'tablas chicas: leerlas completas es rápido' })
  }
  const floja = grandes[0]
  const valor = Math.max(0, Math.min(100, 100 - Math.max(0, floja.pct - 10)))
  return pieza({
    id: 'indices',
    nombre: 'Índices',
    valor,
    corto: `${floja.nombre} se lee completa el ${floja.pct}% de las veces`,
    lectura:
      valor >= 90
        ? `${grandes.length} ${grandes.length === 1 ? 'tabla grande usa' : 'tablas grandes usan'} su índice`
        : `${floja.nombre} (${floja.vivos.toLocaleString('es-MX')} registros) se lee completa el ${floja.pct}% de las veces: le falta un índice`,
  })
}

/** Registros muertos sin purgar: válvula que hay que limpiar antes de que el sistema se haga lento. */
function piezaLimpieza(m: Metricas | null, tablas: Tabla[]): PiezaMedida {
  if (!m?.tablas) return pieza({ id: 'limpieza', nombre: 'Limpieza', valor: null, lectura: 'sin lectura' })
  if (!tablas.length) return pieza({ id: 'limpieza', nombre: 'Limpieza', valor: 100, lectura: 'tablas chicas, nada que purgar' })
  const sucia = tablas
    .map((t) => ({ ...t, pct: Math.round((t.muertos / Math.max(1, t.vivos + t.muertos)) * 100) }))
    .sort((a, b) => b.pct - a.pct)[0]
  const valor = Math.max(0, Math.min(100, 100 - Math.max(0, sucia.pct - 20) * 2))
  return pieza({
    id: 'limpieza',
    nombre: 'Limpieza',
    valor,
    corto: `${sucia.nombre} con ${sucia.pct}% de registros muertos`,
    lectura: valor >= 90 ? `${tablas.length} tablas al día (la más alta: ${sucia.pct}% muertos)` : `${sucia.nombre}: ${sucia.pct}% de registros muertos sin purgar`,
  })
}

function piezaApp(nombre: string, lista: EstadoApp[], disponible: boolean): PiezaMedida {
  const app = lista.find((a) => a.nombre === nombre)
  if (!disponible || !app) return pieza({ id: 'app', nombre: `App (${nombre})`, valor: null, lectura: 'sin lectura de Vercel' })
  const bien = ESTADOS_SIRVIENDO.has(app.estado ?? '')
  return pieza({
    id: 'app',
    nombre: `App (${nombre})`,
    valor: bien ? 100 : 0,
    corto: 'su deploy en producción no está listo',
    lectura: `deploy en producción: ${estadoLegible(app.estado)}`,
  })
}

let cacheLectura: { en: number; r: Promise<PanelControlRespuesta> } | null = null

/** Una sola lectura cada 30 s aunque estén abiertos el panel y el aviso en varias pestañas. */
export function leerPanelControl(): Promise<PanelControlRespuesta> {
  if (cacheLectura && Date.now() - cacheLectura.en < 30_000) return cacheLectura.r
  const r = leerPanelControlSinCache()
  cacheLectura = { en: Date.now(), r }
  r.catch(() => {
    cacheLectura = null
  })
  return r
}

async function leerPanelControlSinCache(): Promise<PanelControlRespuesta> {
  const rpcMedido = (async () => {
    const t = Date.now()
    const r = await createDbAdmin().rpc('panel_control_metricas')
    return { r, ms: Date.now() - t }
  })()

  const [rpc, apps, deploys] = await Promise.allSettled([rpcMedido, estadoApps(), deploysVercel()])
  const valorDe = <T,>(r: PromiseSettledResult<T>): T | undefined => (r.status === 'fulfilled' ? r.value : undefined)

  let m: Metricas | null = null
  let msBase = 0
  let errorBase = 'Sin respuesta'
  if (rpc.status === 'fulfilled') {
    msBase = rpc.value.ms
    if (!rpc.value.r.error && rpc.value.r.data) m = rpc.value.r.data as Metricas
    else errorBase = rpc.value.r.error?.message ?? errorBase
  } else {
    errorBase = String((rpc.reason as Error)?.message ?? rpc.reason)
  }

  const piezaBase = m
    ? pieza({
        id: 'base',
        nombre: 'Base de datos',
        valor: puntajeLatencia(msBase, PRESUPUESTO_BASE_MS),
        corto: `lenta (contesta en ${seg(msBase)})`,
        lectura: `contesta en ${seg(msBase)}`,
      })
    : pieza({ id: 'base', nombre: 'Base de datos', valor: 0, lectura: 'no contesta', fallo: errorBase })

  const ev = m?.piezas ?? {}
  const correo = piezaServicio('correo', 'Correo (Gmail)', ev.correo, PRESUPUESTO_MS.correo)
  const wh = m?.openpay_webhook
  const avisosOpenpay = pieza({
    id: 'openpay-avisos',
    nombre: 'Avisos de Openpay',
    valor: wh && wh.ops ? puntajeFallos(wh.fallos, wh.ops) : null,
    corto: wh?.ops ? `${Math.round((wh.fallos / wh.ops) * 100)}% de avisos fallan` : undefined,
    lectura: wh?.ops ? fallosDe(wh.fallos, wh.ops) : 'sin avisos en 24 h',
    fallo: wh?.fallos ? wh.ultimo_fallo ?? undefined : undefined,
  })

  const listaApps = valorDe(apps) ?? []
  const caidas = listaApps.filter((a) => !ESTADOS_SIRVIENDO.has(a.estado ?? ''))
  const appOpenHouse = listaApps.find((a) => a.nombre === 'Open House')
  const k = m?.kommo
  const atrasados = Number(k?.recordatorios_atrasados ?? 0)

  const medidores: MedidorProceso[] = [
    proceso('pagos', 'Pagos', 'Pasarelas de cobro y avisos de pago', [
      piezaServicio('banorte', 'Banorte (tarjeta)', ev.banorte, PRESUPUESTO_MS.banorte),
      piezaServicio('openpay-api', 'Openpay (SPEI)', ev['openpay-api'], PRESUPUESTO_MS['openpay-api']),
      avisosOpenpay,
      piezaBase,
    ]),
    proceso('facturacion', 'Facturación CFDI', 'Timbrado con el PAC y archivo de facturas', [
      piezaServicio('pac', 'PAC FacturoPorTi', ev.pac, PRESUPUESTO_MS.pac),
      piezaServicio('storage-cfdi', 'Storage de facturas', ev['storage-cfdi'], PRESUPUESTO_MS['storage-cfdi']),
      piezaBase,
    ]),
    proceso('reportes', 'Reportes RAC', 'Envío de reportes y agenda de citas', [
      correo,
      piezaServicio('google-calendar', 'Google Calendar', ev['google-calendar'], PRESUPUESTO_MS['google-calendar']),
      piezaBase,
    ]),
    proceso('talleres', 'Talleres', 'Registro de listas y alertas automáticas', [
      piezaBase,
      piezaLatido('cron-talleres-minimo', m?.latidos['cron-talleres-minimo']),
      correo,
    ]),
    proceso('open-house', 'Open House', 'Registro, integración con Kommo y recordatorios', [
      appOpenHouse
        ? pieza({
            id: 'app-open-house',
            nombre: 'App de registro',
            valor: ESTADOS_SIRVIENDO.has(appOpenHouse.estado ?? '') ? 100 : 0,
            corto: 'su deploy en producción no está listo',
            lectura: `deploy en producción: ${estadoLegible(appOpenHouse.estado)}`,
          })
        : pieza({ id: 'app-open-house', nombre: 'App de registro', valor: null, lectura: 'falta el token de lectura de Vercel' }),
      pieza({
        id: 'kommo',
        nombre: 'Integración Kommo',
        valor: k?.registros ? Math.round((k.con_lead / k.registros) * 100) : null,
        corto: k ? `${k.registros - k.con_lead} registros no llegaron a Kommo` : undefined,
        lectura: k?.registros ? `${k.con_lead} de ${k.registros} registros de 7 días llegaron` : 'sin registros en 7 días',
      }),
      pieza({
        id: 'recordatorios-oh',
        nombre: 'Recordatorios programados',
        valor: k ? (atrasados ? 0 : 100) : null,
        corto: `${atrasados} recordatorios atrasados`,
        lectura: atrasados ? `${atrasados} atrasados más de 2 h` : `al corriente · ${k?.recordatorios_enviados_7d ?? 0} enviados en 7 días`,
      }),
    ]),
    proceso('insforge', 'InsForge', 'Base de datos del proyecto Winston Servicios: respuesta y conexiones', [
      piezaBase,
      m
        ? pieza({
            id: 'conexiones',
            nombre: 'Conexiones',
            valor: valorConexiones((m.base.conexiones / m.base.max_conexiones) * 100),
            corto: `${Math.round((m.base.conexiones / m.base.max_conexiones) * 100)}% de conexiones en uso`,
            lectura: `${m.base.conexiones} de ${m.base.max_conexiones} en uso · base ${Math.round(m.base.bytes / 1024 / 1024)} MB`,
          })
        : pieza({ id: 'conexiones', nombre: 'Conexiones', valor: null, lectura: 'sin lectura' }),
    ]),
    proceso('vercel', 'Vercel', 'Apps de producción y tareas programadas', [
      pieza({
        id: 'apps',
        nombre: 'Apps en producción',
        valor: listaApps.length ? Math.max(0, 100 - caidas.length * 25) : null,
        corto: `${caidas.map((a) => a.nombre).join(', ')} sin deploy listo`,
        lectura: listaApps.length
          ? `${listaApps.length - caidas.length} de ${listaApps.length} con su deploy listo`
          : apps.status === 'rejected'
            ? `Vercel no respondió: ${String((apps.reason as Error)?.message ?? '')}`
            : 'falta el token de lectura de Vercel',
        fallo: caidas.length ? caidas.map((a) => `${a.nombre}: ${estadoLegible(a.estado)}`).join(' · ') : undefined,
      }),
      piezaLatido('cron-recordatorio-liberacion-docs', m?.latidos['cron-recordatorio-liberacion-docs']),
    ]),
    (() => {
      if (deploys.status === 'fulfilled' && deploys.value) {
        const d = deploys.value
        const terminados = d.listos + d.error
        const ultimoFallo = d.ultimo?.estado === 'ERROR'
        return proceso('desarrollo', 'Desarrollo', 'Deploys de producción del proyecto servicios-admin', [
          pieza({
            id: 'deploys',
            nombre: 'Deploys (7 días)',
            valor: ultimoFallo ? 0 : terminados ? Math.round((d.listos / terminados) * 100) : 100,
            corto: ultimoFallo ? 'el último deploy falló' : `${d.error} deploys fallaron`,
            lectura: `${d.total} deploys · ${d.error} con error`,
            fallo: ultimoFallo ? 'El último deploy falló' : undefined,
          }),
        ])
      }
      return proceso('desarrollo', 'Desarrollo', 'Deploys de producción del proyecto servicios-admin', [
        pieza({
          id: 'deploys',
          nombre: 'Deploys (7 días)',
          valor: null,
          lectura:
            deploys.status === 'rejected'
              ? `Vercel no respondió: ${String((deploys.reason as Error)?.message ?? '')}`
              : 'falta el token de lectura de Vercel',
        }),
      ])
    })(),
  ]

  const sistemas = SISTEMAS.map((sis) => {
    const tablas = tablasDe(m, sis.tablas)
    return proceso(sis.id, sis.nombre, sis.mide, [
      ...(sis.app ? [piezaApp(sis.app, listaApps, apps.status === 'fulfilled' && apps.value != null)] : []),
      piezaIndices(m, tablas),
      piezaLimpieza(m, tablas),
    ])
  })

  return { leidoEn: new Date().toISOString(), medidores, sistemas }
}
