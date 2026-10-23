import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  estadoPorValor,
  type Diagnostico,
  type EstadoMedidor,
  type LineaDiagnostico,
  type MedidorProceso,
  type PanelControlRespuesta,
  type PiezaMedida,
} from '@/lib/panelControl/tipos'
import type { PiezaSonda, TareaLatido } from '@/lib/panelControl/sonda'
import { CFDI_EMISOR_CHURCHILL_RFC, CFDI_EMISOR_EDUCATIVO_RFC } from '@/lib/cfdiConfig'
import { diasHastaVencimiento, formatearFechaMx, parsearCsd } from '@/lib/cfdi/csdVencimientos'

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
  /** Por RFC emisor, últimos 7 días; `err_datos_*` = errores por datos fiscales del cliente (no son falla del sistema). */
  timbrado?: Record<string, Timbrado>
  /** Certificado público (.cer en base64) de la e.firma de cada plantel, solo para leer su vigencia. */
  fiel?: Record<string, string>
}

type Timbrado = {
  ok_24h: number
  err_24h: number
  err_datos_24h: number
  ok_7d: number
  err_7d: number
  err_datos_7d: number
  ultimo: string | null
  ultimo_error_en: string | null
  ultimo_error: string | null
}

/**
 * Apps de producción cuyo estado se lee de la API de Vercel (nunca se les hace petición).
 * Fuera: las de prueba y el portal de Desayunos (`services`, apagado a propósito).
 */
/** `proyecto` = nombre en Vercel; mientras publica, el deploy nuevo aún no trae el dominio y se reconoce por él. */
const APPS_PRODUCCION: { nombre: string; url: string; proyecto: string }[] = [
  { nombre: 'Servicios Admin', url: 'https://servicios.winston93.edu.mx/login', proyecto: 'servicios-admin' },
  { nombre: 'Uniformes', url: 'https://uniformes-mu.vercel.app', proyecto: 'uniformes' },
  { nombre: 'Reloj checador', url: 'https://winston-registro.vercel.app', proyecto: 'winston-control' },
  { nombre: 'Becas renovación', url: 'https://becas-renovacion.vercel.app', proyecto: 'becas-renovacion' },
  { nombre: 'Winston USA Program', url: 'https://winston-usa-program.vercel.app', proyecto: 'winston-usa-program' },
  { nombre: 'AgendaW', url: 'https://agendaw.vercel.app', proyecto: 'agendaw' },
  { nombre: 'Open House', url: 'https://open-house-chi.vercel.app', proyecto: 'open-house' },
  { nombre: 'Cheques', url: 'https://cheques-new.vercel.app', proyecto: 'cheques-new' },
  { nombre: 'Caja chica', url: 'https://cchic.vercel.app', proyecto: 'cchic' },
  { nombre: 'SSIW', url: 'https://ssiw.vercel.app', proyecto: 'ssiw' },
  { nombre: 'Contratos', url: 'https://contratos-chi.vercel.app', proyecto: 'contratos' },
  { nombre: 'Prórrogas y ajustes', url: 'https://prorrogas-ajustes.vercel.app', proyecto: 'prorrogas-ajustes' },
]

/** Tiempo aceptable (p95 de operaciones reales) por pieza, en ms. El correo incluye la espera del límite de Gmail. */
const PRESUPUESTO_MS: Record<PiezaSonda, number> = {
  banorte: 8000,
  'openpay-api': 4000,
  pac: 8000,
  'storage-cfdi': 3000,
  correo: 15000,
  'google-calendar': 4000,
  'google-classroom': 15000,
}
const PRESUPUESTO_BASE_MS = 800

/** Conexiones: hasta 80% en uso es normal; de 80 a 90 precaución y desde 90 alarma (al 100% la base rechaza conexiones). */
const CONEXIONES_PRECAUCION = 80

function valorConexiones(uso: number): number {
  if (uso < CONEXIONES_PRECAUCION) return 100
  return Math.max(0, Math.round(89 - (uso - CONEXIONES_PRECAUCION) * 3))
}

/**
 * A la entrada de la escuela los grupos de conexiones crecen unos segundos y luego se encogen solos:
 * se califica con la menor de las dos últimas lecturas (si la anterior tiene menos de 5 min),
 * así la precaución o la alarma solo salen si el uso sigue alto en dos lecturas seguidas.
 */
let ultimaConexiones: { en: number; uso: number } | null = null

function usoConexionesCalificado(uso: number): { uso: number; pico: boolean } {
  const previa = ultimaConexiones && Date.now() - ultimaConexiones.en < 5 * 60_000 ? ultimaConexiones.uso : null
  ultimaConexiones = { en: Date.now(), uso }
  if (previa == null || previa >= uso) return { uso, pico: false }
  return { uso: previa, pico: valorConexiones(uso) < valorConexiones(previa) }
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
/** Con menos lecturas (desde su último arreglo) el porcentaje no dice nada: un solo escaneo daría 100%. */
const LECTURAS_MINIMAS = 50

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
      name?: string
      targets?: { production?: { alias?: string[]; readyState?: string } }
      latestDeployments?: { target?: string | null; readyState?: string; alias?: string[] }[]
    }[]
  }
  const proyectos = json.projects ?? []
  const datos = APPS_PRODUCCION.map(({ nombre, url, proyecto }) => {
    const host = new URL(url).host
    const p =
      proyectos.find(
        (x) =>
          x.targets?.production?.alias?.includes(host) ||
          x.latestDeployments?.some((d) => d.target === 'production' && d.alias?.includes(host))
      ) ?? proyectos.find((x) => x.name === proyecto)
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
const linea = (texto: string, estado: EstadoMedidor): LineaDiagnostico => ({ texto, estado })
const noAplica = (texto = 'No aplica') => linea(texto, 'sin-dato')
const diag = (operatividad: LineaDiagnostico, eficiencia: LineaDiagnostico, errores: LineaDiagnostico): Diagnostico => ({
  operatividad,
  eficiencia,
  errores,
})

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
  const exitos = ops - fallos
  return pieza({
    id,
    nombre,
    valor: causa?.valor ?? null,
    corto: causa?.corto,
    lectura,
    fallo: fallos ? ev?.ultimo_fallo ?? undefined : undefined,
    diag: ops
      ? diag(
          exitos > 0
            ? linea(`Operando: ${exitos} de ${ops} operaciones salieron bien en 24 h`, 'normal')
            : linea(`No opera: sus ${ops} operaciones de 24 h fallaron`, 'alarma'),
          p95 != null
            ? linea(
                `Tarda hasta ${seg(p95)}${ev?.ms_prom != null ? `, en promedio ${seg(Number(ev.ms_prom))}` : ''} (aceptable: ${seg(presupuesto)})`,
                estadoPorValor(puntajeLatencia(p95, presupuesto)),
              )
            : noAplica('Sin tiempos registrados'),
          fallos
            ? linea(
                `${fallos} ${fallos === 1 ? 'error' : 'errores'} del sistema en 24 h${ev?.ultimo_fallo ? ` · último: ${ev.ultimo_fallo}` : ''}`,
                estadoPorValor(puntajeFallos(fallos, ops)),
              )
            : linea('Sin errores en las últimas 24 h', 'normal'),
        )
      : diag(noAplica('Sin uso en 24 h: nadie lo ocupó, no hay qué medir'), noAplica('Sin datos'), linea('Sin errores en las últimas 24 h', 'normal')),
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
  if (!l)
    return pieza({
      id: tarea,
      nombre,
      valor: null,
      lectura: 'sin latido todavía (empieza en su siguiente corrida)',
      diag: diag(noAplica('Aún no corre: empieza en su siguiente horario'), noAplica('Sin datos'), noAplica('Sin datos')),
    })
  const esperada = ultimaEjecucionEsperada(horaUtc, dias)
  const margen = 20 * 60 * 1000
  const intento = new Date(l.ultimo_intento).getTime()
  const ultimoOk = l.ultimo_ok ? new Date(l.ultimo_ok).getTime() : 0
  if (intento >= esperada.getTime() - margen && !l.ok) {
    return pieza({
      id: tarea,
      nombre,
      valor: 0,
      corto: 'falló en su última corrida',
      lectura: `falló ${horaLocal(l.ultimo_intento)}`,
      fallo: l.detalle ?? undefined,
      diag: diag(
        linea(`Corrió ${horaLocal(l.ultimo_intento)} pero falló`, 'alarma'),
        linea(`Tardó ${seg(l.ms)}`, 'sin-dato'),
        linea(`Error en su última corrida${l.detalle ? `: ${l.detalle}` : ''}`, 'alarma'),
      ),
    })
  }
  if (ultimoOk < esperada.getTime() - margen && Date.now() > esperada.getTime() + margen) {
    return pieza({
      id: tarea,
      nombre,
      valor: 0,
      corto: 'no corrió a su hora',
      lectura: `no corrió a su hora · último ok ${l.ultimo_ok ? horaLocal(l.ultimo_ok) : 'nunca'}`,
      diag: diag(
        linea('No corrió a su hora', 'alarma'),
        noAplica('Sin corrida que medir'),
        linea(`Último ok: ${l.ultimo_ok ? horaLocal(l.ultimo_ok) : 'nunca'}`, 'alarma'),
      ),
    })
  }
  return pieza({
    id: tarea,
    nombre,
    valor: 100,
    lectura: `corrió ${horaLocal(l.ultimo_ok ?? l.ultimo_intento)} en ${seg(l.ms)}`,
    diag: diag(
      linea(`Operando: corrió a su hora (${horaLocal(l.ultimo_ok ?? l.ultimo_intento)})`, 'normal'),
      linea(`Tardó ${seg(l.ms)}`, 'normal'),
      linea('Sin errores en su última corrida', 'normal'),
    ),
  })
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

/** Más de 90 días = 100; de 90 a 31 precaución (89 a 60); 30 días o menos alarma; vencido = 0. */
function valorVigencia(dias: number): number {
  if (dias > 90) return 100
  if (dias > 30) return 60 + Math.round(((dias - 30) / 60) * 29)
  return Math.max(0, Math.round((dias / 30) * 59))
}

type Vigencia = { desde: Date; hasta: Date } | { error: string }

function vigenciaDe(b64: string | undefined, falta: string): Vigencia {
  if (!b64?.trim()) return { error: falta }
  try {
    return parsearCsd(b64)
  } catch {
    return { error: 'certificado ilegible' }
  }
}

/** Sello digital (CSD, con el que se timbra) o e.firma (FIEL, con la que se firma ante el SAT y se renueva el sello). */
function piezaVigencia(id: string, nombre: string, uso: string, renovar: string, v: Vigencia): PiezaMedida {
  if ('error' in v) {
    return pieza({
      id,
      nombre,
      valor: null,
      lectura: v.error,
      diag: diag(noAplica(`Sin lectura: ${v.error}`), noAplica('Sin datos'), noAplica('Sin datos')),
    })
  }
  const dias = diasHastaVencimiento(v.hasta)
  const valor = valorVigencia(dias)
  const estado = estadoPorValor(valor)
  const vence = formatearFechaMx(v.hasta)
  return pieza({
    id,
    nombre,
    valor,
    corto: dias < 0 ? 'vencido' : `vence en ${dias} días`,
    lectura: dias < 0 ? `venció el ${vence}` : `vence el ${vence} · faltan ${dias} días`,
    fallo: dias < 0 ? `Vencido: ya no sirve para ${uso}` : undefined,
    diag: diag(
      dias < 0
        ? linea(`Vencido desde el ${vence}: ya no sirve para ${uso}`, 'alarma')
        : linea(`Operando: vigente desde el ${formatearFechaMx(v.desde)}, sirve para ${uso}`, 'normal'),
      linea(dias < 0 ? `Venció hace ${-dias} días` : `Vence el ${vence}: faltan ${dias} días (margen sano: más de 90)`, estado),
      dias <= 90 ? linea(`${renovar} antes del ${vence}`, estado) : linea('Sin pendientes: vigente con margen', 'normal'),
    ),
  })
}

/** Califica solo los errores del sistema; los de datos fiscales del cliente se muestran aparte. */
function piezaTimbrado(id: string, nombre: string, t: Timbrado | undefined, disponible: boolean): PiezaMedida {
  if (!disponible) return pieza({ id, nombre, valor: null, lectura: 'sin lectura' })
  const ok7 = Number(t?.ok_7d ?? 0)
  const err7 = Number(t?.err_7d ?? 0)
  const datos7 = Number(t?.err_datos_7d ?? 0)
  const sis7 = err7 - datos7
  const total7 = ok7 + err7
  if (!total7) {
    return pieza({
      id,
      nombre,
      valor: null,
      lectura: 'sin timbres en 7 días',
      diag: diag(noAplica('Sin timbres en 7 días: no hay qué medir'), noAplica('Sin datos'), linea('Sin errores en 7 días', 'normal')),
    })
  }
  const ok24 = Number(t?.ok_24h ?? 0)
  const err24 = Number(t?.err_24h ?? 0)
  const datos24 = Number(t?.err_datos_24h ?? 0)
  const sis24 = err24 - datos24
  const total24 = ok24 + err24
  const valor = puntajeFallos(sis7, total7)
  const intentosSistema = ok7 + sis7
  const eficiencia = intentosSistema ? Math.round((ok7 / intentosSistema) * 100) : 100
  const deDatos = (n: number) => (n ? ` · ${n} por datos mal capturados del cliente (no cuentan)` : '')
  const ultimo = t?.ultimo_error ? ` · último: ${t.ultimo_error}` : ''
  return pieza({
    id,
    nombre,
    valor,
    corto: `${sis7} ${sis7 === 1 ? 'error' : 'errores'} del sistema en 7 días`,
    lectura: `${ok7} timbrados en 7 días · ${sis7} ${sis7 === 1 ? 'error' : 'errores'} del sistema${datos7 ? ` · ${datos7} por datos del cliente` : ''}`,
    fallo: sis7 ? t?.ultimo_error ?? undefined : undefined,
    diag: diag(
      !ok7 && sis7
        ? linea(`No timbra: sus ${sis7} intentos de 7 días fallaron por el sistema`, 'alarma')
        : total24
          ? linea(`Operando: ${ok24} ${ok24 === 1 ? 'factura timbrada' : 'facturas timbradas'} en 24 h${deDatos(datos24)}`, ok24 || !sis24 ? 'normal' : 'alarma')
          : linea(`Operando: sin timbres en 24 h · último ${t?.ultimo ? horaLocal(t.ultimo) : 'sin fecha'}`, 'normal'),
      linea(`Eficiencia del sistema en 7 días: ${eficiencia}% (${ok7} de ${intentosSistema})${deDatos(datos7)}`, estadoPorValor(valor)),
      sis24
        ? linea(`${sis24} ${sis24 === 1 ? 'error' : 'errores'} del sistema en 24 h${ultimo}`, estadoPorValor(puntajeFallos(sis24, total24)))
        : sis7
          ? linea(`Sin errores del sistema en 24 h · ${sis7} en 7 días`, estadoPorValor(valor))
          : linea(`Sin errores del sistema en 7 días${deDatos(datos7)}`, 'normal'),
    ),
  })
}

function bienDe(e: EventosPieza | undefined): string {
  const ops = Number(e?.ops ?? 0)
  return ops ? `${ops - Number(e?.fallos ?? 0)}/${ops} ok` : 'sin uso'
}

function latidoDe(l: Latido | undefined): string {
  return !l ? 'sin latido' : l.ok ? 'ok' : 'falló'
}

const compacto = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 })

function proceso(id: string, nombre: string, mide: string, piezas: PiezaMedida[], info?: string[]): MedidorProceso {
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
  return { id, nombre, mide, valor, estado, piezas, resumen, ...(info?.length ? { info } : {}) }
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
  const grandesTodas = tablas.filter((t) => t.vivos >= TABLA_GRANDE)
  const grandes = grandesTodas
    .filter((t) => t.completas + t.indice >= LECTURAS_MINIMAS)
    .map((t) => ({ ...t, pct: Math.round((t.completas / Math.max(1, t.completas + t.indice)) * 100) }))
    .sort((a, b) => b.pct - a.pct)
  if (!grandes.length && grandesTodas.length) {
    return pieza({
      id: 'indices',
      nombre: 'Índices',
      valor: 100,
      lectura: `pocas lecturas todavía para calificar (menos de ${LECTURAS_MINIMAS})`,
      diag: diag(
        linea(`Operando: ${grandesTodas.length} ${grandesTodas.length === 1 ? 'tabla grande' : 'tablas grandes'} con poco uso`, 'normal'),
        linea(`Se califica al juntar ${LECTURAS_MINIMAS} lecturas desde su último arreglo`, 'normal'),
        noAplica('No aplica: mide rendimiento, no errores'),
      ),
    })
  }
  if (!grandes.length) {
    return pieza({
      id: 'indices',
      nombre: 'Índices',
      valor: 100,
      lectura: 'tablas chicas: leerlas completas es rápido',
      diag: diag(
        linea(`Operando: ${tablas.length} ${tablas.length === 1 ? 'tabla' : 'tablas'} en uso`, 'normal'),
        linea('Tablas chicas: leerlas completas es rápido', 'normal'),
        noAplica('No aplica: mide rendimiento, no errores'),
      ),
    })
  }
  const floja = grandes[0]
  const valor = Math.max(0, Math.min(100, 100 - Math.max(0, floja.pct - 10)))
  return pieza({
    id: 'indices',
    nombre: 'Índices',
    valor,
    diag: diag(
      linea(`Operando: ${grandes.length} ${grandes.length === 1 ? 'tabla grande' : 'tablas grandes'} en uso`, 'normal'),
      linea(`${floja.nombre} usa su índice el ${100 - floja.pct}% de las veces`, estadoPorValor(valor)),
      noAplica('No aplica: mide rendimiento, no errores'),
    ),
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
    diag: diag(
      linea(`Operando: ${tablas.length} ${tablas.length === 1 ? 'tabla' : 'tablas'} con datos`, 'normal'),
      linea(`La más cargada: ${sucia.nombre} con ${sucia.pct}% de registros muertos (tolerable hasta 20%)`, estadoPorValor(valor)),
      noAplica('No aplica: mide mantenimiento, no errores'),
    ),
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
    diag: diagApp(app.estado),
    corto: 'su deploy en producción no está listo',
    lectura: `deploy en producción: ${estadoLegible(app.estado)}`,
  })
}

function diagApp(estado: string | null): Diagnostico {
  const bien = ESTADOS_SIRVIENDO.has(estado ?? '')
  return diag(
    bien ? linea(`Operando: en línea (${estadoLegible(estado)})`, 'normal') : linea(`Fuera de línea: ${estadoLegible(estado)}`, 'alarma'),
    noAplica('Se mide en Vercel sin tocar la app'),
    estado === 'ERROR' ? linea('Su última publicación terminó con error', 'alarma') : linea('Sin errores en su publicación', 'normal'),
  )
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

  const usoConexiones = m ? (m.base.conexiones / m.base.max_conexiones) * 100 : 0
  const conexiones = m ? usoConexionesCalificado(usoConexiones) : { uso: 0, pico: false }

  const piezaBase = m
    ? pieza({
        id: 'base',
        nombre: 'Base de datos',
        valor: puntajeLatencia(msBase, PRESUPUESTO_BASE_MS),
        corto: `lenta (contesta en ${seg(msBase)})`,
        lectura: `contesta en ${seg(msBase)}`,
        diag: diag(
          linea('Operando: contesta', 'normal'),
          linea(`Contesta en ${seg(msBase)} (aceptable: ${seg(PRESUPUESTO_BASE_MS)})`, estadoPorValor(puntajeLatencia(msBase, PRESUPUESTO_BASE_MS))),
          linea('Sin errores en esta lectura', 'normal'),
        ),
      })
    : pieza({
        id: 'base',
        nombre: 'Base de datos',
        valor: 0,
        lectura: 'no contesta',
        fallo: errorBase,
        diag: diag(linea('No contesta', 'alarma'), noAplica('Sin respuesta que medir'), linea(`Error: ${errorBase}`, 'alarma')),
      })

  const ev = m?.piezas ?? {}
  const correo = piezaServicio('correo', 'Correo (Gmail)', ev.correo, PRESUPUESTO_MS.correo)
  const wh = m?.openpay_webhook
  const avisosOpenpay = pieza({
    id: 'openpay-avisos',
    nombre: 'Avisos de Openpay',
    valor: wh && wh.ops ? puntajeFallos(wh.fallos, wh.ops) : null,
    corto: wh?.ops ? `${Math.round((wh.fallos / wh.ops) * 100)}% de avisos fallan` : undefined,
    lectura: wh?.ops ? fallosDe(wh.fallos, wh.ops) : 'sin avisos en 24 h',
    diag: wh?.ops
      ? diag(
          linea(`Operando: ${wh.ops - wh.fallos} de ${wh.ops} avisos recibidos bien en 24 h`, wh.ops > wh.fallos ? 'normal' : 'alarma'),
          noAplica('Se mide la entrega, no el tiempo'),
          wh.fallos
            ? linea(
                `${wh.fallos} ${wh.fallos === 1 ? 'aviso falló' : 'avisos fallaron'} en 24 h${wh.ultimo_fallo ? ` · último: ${wh.ultimo_fallo}` : ''}`,
                estadoPorValor(puntajeFallos(wh.fallos, wh.ops)),
              )
            : linea('Sin errores en las últimas 24 h', 'normal'),
        )
      : diag(noAplica('Sin avisos en 24 h: no hubo pagos SPEI'), noAplica('Sin datos'), linea('Sin errores en las últimas 24 h', 'normal')),
    fallo: wh?.fallos ? wh.ultimo_fallo ?? undefined : undefined,
  })

  const listaApps = valorDe(apps) ?? []
  const caidas = listaApps.filter((a) => !ESTADOS_SIRVIENDO.has(a.estado ?? ''))
  const appOpenHouse = listaApps.find((a) => a.nombre === 'Open House')
  const k = m?.kommo
  const atrasados = Number(k?.recordatorios_atrasados ?? 0)

  const vigencias = {
    selloEdu: vigenciaDe(process.env.FACTUROPORTI_EDUCATIVO_CSD, 'falta el sello en el servidor'),
    selloIwc: vigenciaDe(process.env.FACTUROPORTI_CHURCHILL_CSD, 'falta el sello en el servidor'),
    firmaEdu: m ? vigenciaDe(m.fiel?.EDUCATIVO, 'sin e.firma cargada') : ({ error: 'sin lectura' } as Vigencia),
    firmaIwc: m ? vigenciaDe(m.fiel?.WINSTON, 'sin e.firma cargada') : ({ error: 'sin lectura' } as Vigencia),
  }
  const diasFirmas = Object.values(vigencias).flatMap((v) => ('error' in v ? [] : [diasHastaVencimiento(v.hasta)]))
  const timbres = (rfc: string) => (m?.timbrado ? String(Number(m.timbrado[rfc]?.ok_7d ?? 0)) : '—')

  const medidores: MedidorProceso[] = [
    proceso('pagos', 'Pagos', 'Pasarelas de cobro y avisos de pago', [
      piezaServicio('banorte', 'Banorte (tarjeta)', ev.banorte, PRESUPUESTO_MS.banorte),
      piezaServicio('openpay-api', 'Openpay (SPEI)', ev['openpay-api'], PRESUPUESTO_MS['openpay-api']),
      avisosOpenpay,
      piezaBase,
    ], [`Banorte ${bienDe(ev.banorte)}`, `SPEI ${bienDe(ev['openpay-api'])}`]),
    proceso('facturacion', 'Facturación CFDI', 'Timbrado, sellos y e.firmas de ambos planteles', [
      piezaTimbrado('timbrado-educativo', 'Timbrado Educativo Winston', m?.timbrado?.[CFDI_EMISOR_EDUCATIVO_RFC], !!m?.timbrado),
      piezaTimbrado('timbrado-churchill', 'Timbrado Winston Churchill', m?.timbrado?.[CFDI_EMISOR_CHURCHILL_RFC], !!m?.timbrado),
      piezaVigencia(
        'sello-educativo',
        'Sello digital Educativo',
        'timbrar facturas',
        'Tramitar el sello nuevo en el SAT y cargarlo en Vercel',
        vigencias.selloEdu,
      ),
      piezaVigencia(
        'sello-churchill',
        'Sello digital Churchill',
        'timbrar facturas',
        'Tramitar el sello nuevo en el SAT y cargarlo en Vercel',
        vigencias.selloIwc,
      ),
      piezaVigencia(
        'efirma-educativo',
        'e.firma Educativo',
        'firmar ante el SAT y renovar el sello',
        'Renovar la e.firma en el SAT y volver a cargarla',
        vigencias.firmaEdu,
      ),
      piezaVigencia(
        'efirma-churchill',
        'e.firma Churchill',
        'firmar ante el SAT y renovar el sello',
        'Renovar la e.firma en el SAT y volver a cargarla',
        vigencias.firmaIwc,
      ),
      piezaServicio('pac', 'PAC FacturoPorTi', ev.pac, PRESUPUESTO_MS.pac),
      piezaServicio('storage-cfdi', 'Storage de facturas', ev['storage-cfdi'], PRESUPUESTO_MS['storage-cfdi']),
      piezaBase,
    ], [
      `IEW ${timbres(CFDI_EMISOR_EDUCATIVO_RFC)} · IWC ${timbres(CFDI_EMISOR_CHURCHILL_RFC)}`,
      diasFirmas.length ? `Firma vence: ${Math.min(...diasFirmas)} d` : 'Firmas sin lectura',
    ]),
    proceso('reportes', 'Reportes RAC', 'Envío de reportes y agenda de citas', [
      correo,
      piezaServicio('google-calendar', 'Google Calendar', ev['google-calendar'], PRESUPUESTO_MS['google-calendar']),
      piezaBase,
    ], [`Correo ${bienDe(ev.correo)}`, `Calendar ${bienDe(ev['google-calendar'])}`]),
    proceso('talleres', 'Talleres', 'Registro de listas y alertas automáticas', [
      piezaBase,
      piezaLatido('cron-talleres-minimo', m?.latidos['cron-talleres-minimo']),
      correo,
    ], [`Tarea 8:00: ${latidoDe(m?.latidos['cron-talleres-minimo'])}`, `Correo ${bienDe(ev.correo)}`]),
    proceso('open-house', 'Open House', 'Registro, integración con Kommo y recordatorios', [
      appOpenHouse
        ? pieza({
            id: 'app-open-house',
            nombre: 'App de registro',
            valor: ESTADOS_SIRVIENDO.has(appOpenHouse.estado ?? '') ? 100 : 0,
            corto: 'su deploy en producción no está listo',
            lectura: `deploy en producción: ${estadoLegible(appOpenHouse.estado)}`,
            diag: diagApp(appOpenHouse.estado),
          })
        : pieza({ id: 'app-open-house', nombre: 'App de registro', valor: null, lectura: 'falta el token de lectura de Vercel' }),
      pieza({
        id: 'kommo',
        nombre: 'Integración Kommo',
        valor: k?.registros ? Math.round((k.con_lead / k.registros) * 100) : null,
        corto: k ? `${k.registros - k.con_lead} registros no llegaron a Kommo` : undefined,
        lectura: k?.registros ? `${k.con_lead} de ${k.registros} registros de 7 días llegaron` : 'sin registros en 7 días',
        diag: k?.registros
          ? diag(
              linea(`Operando: ${k.registros} registros en 7 días`, 'normal'),
              linea(
                `${Math.round((k.con_lead / k.registros) * 100)}% llegaron a Kommo como prospecto`,
                estadoPorValor(Math.round((k.con_lead / k.registros) * 100)),
              ),
              k.registros - k.con_lead
                ? linea(`${k.registros - k.con_lead} no llegaron a Kommo (7 días)`, estadoPorValor(Math.round((k.con_lead / k.registros) * 100)))
                : linea('Sin errores: todos llegaron', 'normal'),
            )
          : diag(noAplica('Sin registros en 7 días'), noAplica('Sin datos'), linea('Sin errores', 'normal')),
      }),
      pieza({
        id: 'recordatorios-oh',
        nombre: 'Recordatorios programados',
        valor: k ? (atrasados ? 0 : 100) : null,
        corto: `${atrasados} recordatorios atrasados`,
        lectura: atrasados ? `${atrasados} atrasados más de 2 h` : `al corriente · ${k?.recordatorios_enviados_7d ?? 0} enviados en 7 días`,
        diag: k
          ? diag(
              linea(`Operando: ${k.recordatorios_enviados_7d} enviados en 7 días`, 'normal'),
              atrasados ? linea(`${atrasados} con más de 2 h de atraso`, 'alarma') : linea('Al corriente, ninguno atrasado', 'normal'),
              atrasados ? linea(`${atrasados} sin enviar a tiempo`, 'alarma') : linea('Sin errores', 'normal'),
            )
          : undefined,
      }),
    ], k ? [`Kommo ${k.con_lead}/${k.registros} (7 d)`, `${k.recordatorios_enviados_7d} avisos (7 d)`] : undefined),
    proceso('insforge', 'InsForge', 'Base de datos del proyecto Winston Servicios: respuesta y conexiones', [
      piezaBase,
      m
        ? pieza({
            id: 'conexiones',
            nombre: 'Conexiones',
            valor: valorConexiones(conexiones.uso),
            corto: conexiones.pico
              ? `Pico de ${Math.round(usoConexiones)}%: se califica si sigue en la próxima lectura`
              : `${Math.round(usoConexiones)}% de conexiones en uso`,
            lectura: `${m.base.conexiones} de ${m.base.max_conexiones} en uso · base ${Math.round(m.base.bytes / 1024 / 1024)} MB`,
            diag: diag(
              m.base.conexiones < m.base.max_conexiones
                ? linea('Operando: acepta conexiones nuevas', 'normal')
                : linea('Llena: rechaza conexiones nuevas', 'alarma'),
              linea(
                `${m.base.conexiones} de ${m.base.max_conexiones} en uso (${Math.round(usoConexiones)}%)` +
                  (conexiones.pico ? ' · pico: la lectura anterior estaba más baja' : ''),
                estadoPorValor(valorConexiones(conexiones.uso)),
              ),
              m.base.conexiones < m.base.max_conexiones ? linea('Sin rechazos: hay lugar', 'normal') : linea('Rechazando conexiones', 'alarma'),
            ),
          })
        : pieza({ id: 'conexiones', nombre: 'Conexiones', valor: null, lectura: 'sin lectura' }),
    ], m ? [`${m.base.conexiones}/${m.base.max_conexiones} conexiones`, `${Math.round(m.base.bytes / 1024 / 1024)} MB · ${seg(msBase)}`] : undefined),
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
        diag: listaApps.length
          ? diag(
              linea(
                `Operando: ${listaApps.length - caidas.length} de ${listaApps.length} apps en línea`,
                caidas.length ? estadoPorValor(Math.max(0, 100 - caidas.length * 25)) : 'normal',
              ),
              noAplica('Se mide en Vercel sin tocar las apps'),
              caidas.length ? linea(`Fuera de línea: ${caidas.map((a) => a.nombre).join(', ')}`, 'alarma') : linea('Sin errores: todas publicadas', 'normal'),
            )
          : undefined,
      }),
      piezaLatido('cron-recordatorio-liberacion-docs', m?.latidos['cron-recordatorio-liberacion-docs']),
    ], [
      listaApps.length ? `${listaApps.length - caidas.length}/${listaApps.length} apps ok` : 'Apps sin lectura',
      `Tarea 9:00: ${latidoDe(m?.latidos['cron-recordatorio-liberacion-docs'])}`,
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
            diag: diag(
              ultimoFallo
                ? linea('El último deploy falló: producción sigue con el anterior', 'alarma')
                : linea('Operando: el último deploy quedó publicado', 'normal'),
              linea(
                `${d.listos} de ${terminados || d.total} deploys terminaron bien (7 días)`,
                estadoPorValor(terminados ? Math.round((d.listos / terminados) * 100) : 100),
              ),
              d.error
                ? linea(`${d.error} ${d.error === 1 ? 'deploy' : 'deploys'} con error en 7 días`, ultimoFallo ? 'alarma' : 'precaucion')
                : linea('Sin errores en 7 días', 'normal'),
            ),
          }),
        ], [`${d.total} deploys (7 d)`, `${d.error} con error`])
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
      ...(sis.id === 'boletas'
        ? [piezaServicio('google-classroom', 'Google Classroom', ev['google-classroom'], PRESUPUESTO_MS['google-classroom'])]
        : []),
    ], m?.tablas ? [`${tablas.length} tablas · ${compacto.format(tablas.reduce((a, t) => a + t.vivos, 0))} registros`] : undefined)
  })

  return { leidoEn: new Date().toISOString(), medidores, sistemas }
}
