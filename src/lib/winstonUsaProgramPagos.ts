import type { AppDatabaseClient } from '@/lib/dbTypes'
import { normalizarConceptoNo } from './pagoReferenciaColegiatura'

/**
 * Winston USA Program (conceptos 23/24/25): montos en USD por ciclo, cobrados en MXN
 * con el tipo de cambio del día en que paga el papá, y fecha de apertura por pago.
 */

export type PagoUsa = 1 | 2 | 3

export interface UsaPagoConfig {
  pago: PagoUsa
  monto_usd: number
  /** YYYY-MM-DD */
  fecha_apertura: string
}

export interface TipoCambioDia {
  /** Día (Monterrey) en que aplica. */
  fecha: string
  usd_mxn: number
  /** Fecha del dato en Banxico. */
  fecha_dato: string
  fuente: string
}

/** Banxico SIE: tipo de cambio para solventar obligaciones en moneda extranjera (publicado en el DOF). */
const SERIE_BANXICO = 'SF60653'
/** SIDOF (Diario Oficial), indicador 158 = dólar; mismo dato que la serie de Banxico y sin token. */
const DOF_INDICADOR_DOLAR = 158

/** Piloto: refs que ven Winston USA Program aunque esté cerrado y antes de la fecha de apertura. */
const REFS_PRUEBA_USA = new Set<number>([])

export function esAlumnoPruebaUsa(alumnoRef: string | number | null | undefined): boolean {
  return REFS_PRUEBA_USA.has(Number(alumnoRef))
}
/** Si Banxico no responde, usar el último guardado si no es más viejo que esto. */
const DIAS_MAX_RESPALDO = 5

export function pagoUsaDeConcepto(conceptoNo: string): PagoUsa | null {
  const c = normalizarConceptoNo(conceptoNo)
  if (c === '23') return 1
  if (c === '24') return 2
  if (c === '25') return 3
  return null
}

export function hoyMonterreyIso(fecha = new Date()): string {
  return fecha.toLocaleDateString('en-CA', { timeZone: 'America/Monterrey' })
}

/** Pesos enteros hacia arriba. */
export function montoMxnDesdeUsd(usd: number, usdMxn: number): number {
  const exacto = Math.round(usd * usdMxn * 10000) / 10000
  return Math.ceil(exacto)
}

export function pagoUsaAbierto(config: UsaPagoConfig | undefined, hoy = hoyMonterreyIso()): boolean {
  return config != null && config.monto_usd > 0 && hoy >= config.fecha_apertura
}

export async function obtenerConfigUsaCiclo(
  db: AppDatabaseClient,
  cicloEscolar: number
): Promise<UsaPagoConfig[]> {
  const { data, error } = await db
    .from('usa_programa_pago')
    .select('pago, monto_usd, fecha_apertura')
    .eq('precio_ciclo_escolar', cicloEscolar)
    .order('pago')
  if (error) {
    if (/does not exist|relation/i.test(error.message)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((r) => ({
    pago: Number(r.pago) as PagoUsa,
    monto_usd: Number(r.monto_usd) || 0,
    fecha_apertura: String(r.fecha_apertura).slice(0, 10),
  }))
}

export function cicloCobraUsaEnUsd(config: UsaPagoConfig[]): boolean {
  return config.some((c) => c.monto_usd > 0)
}

export async function guardarConfigUsaCiclo(
  db: AppDatabaseClient,
  cicloEscolar: number,
  pagos: UsaPagoConfig[]
): Promise<UsaPagoConfig[]> {
  const filas = pagos.map((p) => ({
    precio_ciclo_escolar: cicloEscolar,
    pago: p.pago,
    monto_usd: Math.round(p.monto_usd * 100) / 100,
    fecha_apertura: p.fecha_apertura,
    actualizado_en: new Date().toISOString(),
  }))
  const { error } = await db
    .from('usa_programa_pago')
    .upsert(filas, { onConflict: 'precio_ciclo_escolar,pago' })
  if (error) throw new Error(error.message)
  return obtenerConfigUsaCiclo(db, cicloEscolar)
}

let cacheTc: { hoy: string; valor: TipoCambioDia | null; hasta: number } | null = null

function parseFechaBanxico(s: string): string | null {
  const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

function restarDiasIso(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - dias)
  return d.toISOString().slice(0, 10)
}

function isoADof(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

async function consultarDof(hoy: string): Promise<{ usd_mxn: number; fecha_dato: string } | null> {
  const desde = restarDiasIso(hoy, 10)
  const url = `https://sidof.segob.gob.mx/dof/sidof/indicadores/${DOF_INDICADOR_DOLAR}/${isoADof(desde)}/${isoADof(hoy)}`
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      ListaIndicadores?: { fecha: string; valor: string; codTipoIndicador?: number }[]
    }
    let mejor: { usd_mxn: number; fecha_dato: string } | null = null
    for (const d of json.ListaIndicadores ?? []) {
      if (d.codTipoIndicador != null && Number(d.codTipoIndicador) !== DOF_INDICADOR_DOLAR) continue
      const m = String(d.fecha).match(/^(\d{2})-(\d{2})-(\d{4})$/)
      const fecha = m ? `${m[3]}-${m[2]}-${m[1]}` : null
      const valor = Number(String(d.valor).replace(/,/g, ''))
      if (!fecha || fecha > hoy || !(valor > 0)) continue
      if (!mejor || fecha > mejor.fecha_dato) mejor = { usd_mxn: valor, fecha_dato: fecha }
    }
    return mejor
  } catch {
    return null
  }
}

async function consultarBanxico(hoy: string): Promise<{ usd_mxn: number; fecha_dato: string } | null> {
  const token = process.env.BANXICO_SIE_TOKEN?.trim()
  if (!token) return null
  const desde = restarDiasIso(hoy, 10)
  const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${SERIE_BANXICO}/datos/${desde}/${hoy}?mediaType=json`
  try {
    const res = await fetch(url, {
      headers: { 'Bmx-Token': token, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      bmx?: { series?: { datos?: { fecha: string; dato: string }[] }[] }
    }
    const datos = json.bmx?.series?.[0]?.datos ?? []
    let mejor: { usd_mxn: number; fecha_dato: string } | null = null
    for (const d of datos) {
      const fecha = parseFechaBanxico(d.fecha)
      const valor = Number(String(d.dato).replace(/,/g, ''))
      if (!fecha || fecha > hoy || !(valor > 0)) continue
      if (!mejor || fecha > mejor.fecha_dato) mejor = { usd_mxn: valor, fecha_dato: fecha }
    }
    return mejor
  } catch {
    return null
  }
}

function filaATipoCambio(r: Record<string, unknown>): TipoCambioDia {
  return {
    fecha: String(r.fecha).slice(0, 10),
    usd_mxn: Number(r.usd_mxn),
    fecha_dato: String(r.fecha_dato).slice(0, 10),
    fuente: String(r.fuente),
  }
}

/**
 * Tipo de cambio de hoy. La primera consulta del día queda guardada y es la que usan
 * pantalla, baucher y pago en línea todo el día (la referencia lleva el importe).
 */
export async function obtenerTipoCambioUsdHoy(
  db: AppDatabaseClient,
  hoy = hoyMonterreyIso()
): Promise<TipoCambioDia | null> {
  const ahora = Date.now()
  if (cacheTc && cacheTc.hoy === hoy && cacheTc.hasta > ahora) return cacheTc.valor

  const guardar = (valor: TipoCambioDia | null, ttlMs: number) => {
    cacheTc = { hoy, valor, hasta: ahora + ttlMs }
    return valor
  }

  const { data: existente } = await db
    .from('tipo_cambio_usd_mxn')
    .select('fecha, usd_mxn, fecha_dato, fuente')
    .eq('fecha', hoy)
    .maybeSingle()
  if (existente) return guardar(filaATipoCambio(existente), 60 * 60 * 1000)

  let nuevo: TipoCambioDia | null = null
  const dof = await consultarDof(hoy)
  const banxico = dof ? null : await consultarBanxico(hoy)
  if (dof) {
    nuevo = { fecha: hoy, ...dof, fuente: `dof:${DOF_INDICADOR_DOLAR}` }
  } else if (banxico) {
    nuevo = { fecha: hoy, ...banxico, fuente: `banxico:${SERIE_BANXICO}` }
  } else {
    const { data: ultimo } = await db
      .from('tipo_cambio_usd_mxn')
      .select('fecha, usd_mxn, fecha_dato, fuente')
      .lt('fecha', hoy)
      .gte('fecha', restarDiasIso(hoy, DIAS_MAX_RESPALDO))
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (ultimo) {
      const previo = filaATipoCambio(ultimo)
      nuevo = { fecha: hoy, usd_mxn: previo.usd_mxn, fecha_dato: previo.fecha_dato, fuente: 'respaldo:dia-anterior' }
    }
  }
  if (!nuevo) return guardar(null, 5 * 60 * 1000)

  await db
    .from('tipo_cambio_usd_mxn')
    .upsert([nuevo], { onConflict: 'fecha', ignoreDuplicates: true })
  // Otra instancia pudo guardar primero: usar la fila que quedó.
  const { data: final } = await db
    .from('tipo_cambio_usd_mxn')
    .select('fecha, usd_mxn, fecha_dato, fuente')
    .eq('fecha', hoy)
    .maybeSingle()
  return guardar(final ? filaATipoCambio(final) : nuevo, 60 * 60 * 1000)
}

export interface UsaCobroUsd {
  config: UsaPagoConfig[]
  tipoCambio: TipoCambioDia | null
}

/** null si el ciclo no tiene montos USD (se cobra con los pesos de pago_boucher_precio). */
export async function resolverCobroUsaUsd(
  db: AppDatabaseClient,
  cicloEscolar: number
): Promise<UsaCobroUsd | null> {
  const config = await obtenerConfigUsaCiclo(db, cicloEscolar)
  if (!cicloCobraUsaEnUsd(config)) return null
  return { config, tipoCambio: await obtenerTipoCambioUsdHoy(db) }
}

export function formatearUsd(n: number): string {
  return `USD $${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function notaConversionUsa(usd: number, tc: TipoCambioDia): string {
  return `${formatearUsd(usd)} × ${tc.usd_mxn.toFixed(4)} (tipo de cambio de hoy) · válido solo hoy`
}

export async function obtenerVideoUsaCiclo(db: AppDatabaseClient, cicloEscolar: number): Promise<string | null> {
  const { data, error } = await db
    .from('usa_programa_config')
    .select('video_url')
    .eq('precio_ciclo_escolar', cicloEscolar)
    .maybeSingle()
  if (error) return null
  const url = String(data?.video_url ?? '').trim()
  return url || null
}

export async function guardarVideoUsaCiclo(
  db: AppDatabaseClient,
  cicloEscolar: number,
  videoUrl: string | null
): Promise<void> {
  const url = videoUrl?.trim() || null
  if (url && !/^https:\/\//i.test(url)) throw new Error('El video debe ser un enlace https://')
  const { error } = await db
    .from('usa_programa_config')
    .upsert(
      [{ precio_ciclo_escolar: cicloEscolar, video_url: url, actualizado_en: new Date().toISOString() }],
      { onConflict: 'precio_ciclo_escolar' }
    )
  if (error) throw new Error(error.message)
}
