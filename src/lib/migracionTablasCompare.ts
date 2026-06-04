import type { RowDataPacket } from 'mysql2'
import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { TablaMigracion } from './migracionTablasManifest'
import {
  CAMPOS_FECHA_HORA,
  CAMPOS_SOLO_FECHA,
  debeCompararCampo,
  esCampoNumerico,
} from './migracionTablasManifest'
import { adaptarFilaParaDestino } from './migracionTablasAdaptadores'

/** Lote por defecto al leer filas completas desde InsForge (evita 502 en tablas grandes). */
const LOTE_PK_DEFAULT = 50

/** Tablas con muchas filas o filas anchas: lotes más pequeños. */
const LOTE_PK_POR_TABLA: Partial<Record<string, number>> = {
  pago_detalle: 20,
  pago_interno: 25,
  pago_prorroga: 30,
  usuario: 30,
  alumno_familiar: 35,
  alumno_contacto: 35,
  alumno_detalles: 45,
  alumno_beca: 45,
  pago_desayunos: 45,
}

/** Filas MySQL por iteración en migración (modo con lectura previa). */
const LOTE_MIGRACION_POR_TABLA: Partial<Record<string, number>> = {
  pago_detalle: 40,
  pago_interno: 50,
  pago_prorroga: 60,
  usuario: 60,
  alumno_familiar: 60,
  alumno_contacto: 60,
}

const LOTE_MIGRACION_DEFAULT = 100

/** Mínimo ms entre peticiones al API de InsForge (rate limit por IP). */
const INTERVALO_PETICION_MS: Partial<Record<string, number>> = {
  pago_detalle: 520,
  pago_interno: 480,
  pago_prorroga: 420,
  usuario: 420,
  alumno_familiar: 380,
  alumno_contacto: 380,
}

const INTERVALO_PETICION_DEFAULT = 320

let ultimaPeticionDestino = 0

/** Tablas que siempre migran con upsert masivo (sin leer cada lote antes). */
export const TABLAS_UPSERT_SIN_PRELECTURA = new Set([
  'pago_detalle',
  'pago_interno',
  'pago_prorroga',
  'usuario',
  'alumno_familiar',
  'alumno_contacto',
])

function tamanoLoteLectura(tabla: string): number {
  return LOTE_PK_POR_TABLA[tabla] ?? LOTE_PK_DEFAULT
}

export function tamanoLoteMigracion(tabla: string): number {
  return LOTE_MIGRACION_POR_TABLA[tabla] ?? LOTE_MIGRACION_DEFAULT
}

function tamanoLoteComparacion(tabla: string): number {
  return tamanoLoteLectura(tabla)
}

export { tamanoLoteComparacion }

export function usaUpsertSinPrelectura(tabla: string, filas: number): boolean {
  if (TABLAS_UPSERT_SIN_PRELECTURA.has(tabla)) return true
  return filas > 2500
}

/** Filas MySQL por petición HTTP (evita timeout 300 s en Vercel Hobby). */
const CHUNK_MIGRACION_POR_TABLA: Partial<Record<string, number>> = {
  pago_detalle: 2000,
  pago_interno: 2500,
  pago_prorroga: 3000,
  usuario: 3000,
  alumno_familiar: 2500,
  alumno_contacto: 2500,
}

export function tamanoChunkMigracion(tabla: string): number | null {
  return CHUNK_MIGRACION_POR_TABLA[tabla] ?? null
}

function pausa(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Serializa peticiones para no disparar "Too many requests from this IP". */
export async function throttlePeticionDestino(tabla: string): Promise<void> {
  const intervalo = INTERVALO_PETICION_MS[tabla] ?? INTERVALO_PETICION_DEFAULT
  const ahora = Date.now()
  const esperar = ultimaPeticionDestino + intervalo - ahora
  if (esperar > 0) await pausa(esperar)
  ultimaPeticionDestino = Date.now()
}

function esRateLimitDestino(mensaje: string): boolean {
  const m = mensaje.toLowerCase()
  return (
    m.includes('too many requests') ||
    m.includes('rate limit') ||
    m.includes('429')
  )
}

function esErrorTransitorioDestino(mensaje: string): boolean {
  const m = mensaje.toLowerCase()
  return (
    esRateLimitDestino(mensaje) ||
    m.includes('502') ||
    m.includes('503') ||
    m.includes('504') ||
    m.includes('bad gateway') ||
    m.includes('gateway timeout') ||
    m.includes('fetch failed') ||
    m.includes('econnreset') ||
    m.includes('socket hang up')
  )
}

async function esperaReintentoDestino(mensaje: string, intento: number): Promise<void> {
  if (esRateLimitDestino(mensaje)) {
    await pausa(Math.min(90_000, 12_000 * intento))
    return
  }
  await pausa(600 * intento)
}

const MAX_REINTENTOS_DESTINO = 6

function esFechaMysqlInvalidaTexto(texto: string): boolean {
  const s = texto.trim()
  return !s || s.startsWith('0000-00-00') || /-00/.test(s)
}

function fechaValida(d: Date): boolean {
  return !Number.isNaN(d.getTime())
}

function serializarValor(clave: string, valor: unknown): unknown {
  if (valor === undefined) return undefined
  if (valor === null) return null
  if (Buffer.isBuffer(valor)) return valor.toString('utf8')

  if (typeof valor === 'string' && (CAMPOS_SOLO_FECHA.has(clave) || CAMPOS_FECHA_HORA.has(clave))) {
    if (esFechaMysqlInvalidaTexto(valor)) {
      if (clave === 'beca_registro' || clave === 'beca_actualizacion') {
        return '1970-01-01T00:00:00.000Z'
      }
      return null
    }
    return CAMPOS_SOLO_FECHA.has(clave) ? valor.trim().slice(0, 10) : valor.trim()
  }

  if (valor instanceof Date) {
    if (!fechaValida(valor)) {
      if (clave === 'beca_registro' || clave === 'beca_actualizacion') {
        return '1970-01-01T00:00:00.000Z'
      }
      return null
    }
    if (CAMPOS_SOLO_FECHA.has(clave)) return valor.toISOString().slice(0, 10)
    if (CAMPOS_FECHA_HORA.has(clave)) return valor.toISOString()
    return valor.toISOString()
  }

  if (typeof valor === 'bigint') return Number(valor)

  if (esCampoNumerico(clave) && valor !== null && valor !== '') {
    const n = Number(valor)
    if (!Number.isNaN(n)) return n
  }

  return valor
}

export function serializarFilaMysql(fila: RowDataPacket): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [clave, valor] of Object.entries(fila)) {
    const v = serializarValor(clave, valor)
    if (v !== undefined) out[clave] = v
  }
  return out
}

function normalizarSoloFecha(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return ''
  if (valor instanceof Date) {
    if (!fechaValida(valor)) return ''
    return valor.toISOString().slice(0, 10)
  }
  const s = String(valor).trim()
  if (!s || esFechaMysqlInvalidaTexto(s)) return ''
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : s
}

function normalizarFechaHora(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return ''
  if (valor instanceof Date) {
    if (!fechaValida(valor)) return ''
    return String(Math.floor(valor.getTime() / 1000))
  }
  const s = String(valor).trim()
  if (!s || esFechaMysqlInvalidaTexto(s)) return ''

  let parseable = s
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    parseable = `${s.replace(' ', 'T')}Z`
  }

  const t = Date.parse(parseable)
  if (Number.isNaN(t)) return s
  return String(Math.floor(t / 1000))
}

function normalizarNumerico(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return ''
  const n = Number(valor)
  if (Number.isNaN(n)) return String(valor).trim()
  return n.toFixed(2)
}

/** Canonicaliza un valor según el tipo semántico de la columna. */
export function normalizarValorCampo(clave: string, valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'number' && Number.isNaN(valor)) return ''

  if (CAMPOS_SOLO_FECHA.has(clave)) return normalizarSoloFecha(valor)
  if (CAMPOS_FECHA_HORA.has(clave)) return normalizarFechaHora(valor)
  if (esCampoNumerico(clave)) return normalizarNumerico(valor)

  if (typeof valor === 'boolean') return valor ? '1' : '0'
  if (typeof valor === 'number') return String(valor)
  if (typeof valor === 'object') return JSON.stringify(valor)
  return String(valor).trim()
}

export function valoresEquivalentes(clave: string, a: unknown, b: unknown): boolean {
  return normalizarValorCampo(clave, a) === normalizarValorCampo(clave, b)
}

export function filasIguales(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): boolean {
  for (const k of Object.keys(a)) {
    if (!debeCompararCampo(k)) continue
    if (!valoresEquivalentes(k, a[k], b[k])) return false
  }
  return true
}

export function camposDistintosEntreFilas(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): string[] {
  const diff: string[] = []
  for (const k of Object.keys(a)) {
    if (!debeCompararCampo(k)) continue
    if (!valoresEquivalentes(k, a[k], b[k])) diff.push(k)
  }
  return diff
}

export async function leerFilasMysqlAdaptadas(
  mysql: { query: (sql: string, values?: unknown[]) => Promise<[RowDataPacket[], unknown]> },
  def: TablaMigracion
): Promise<Map<number, Record<string, unknown>>> {
  const [resultado] = await mysql.query(`SELECT * FROM \`${def.mysql}\``)
  const mapa = new Map<number, Record<string, unknown>>()
  for (const f of resultado as RowDataPacket[]) {
    const row = adaptarFilaParaDestino(def, serializarFilaMysql(f))
    const id = Number(row[def.pk])
    if (!Number.isNaN(id)) mapa.set(id, row)
  }
  return mapa
}

export async function leerFilasMysqlAdaptadasPagina(
  mysql: { query: (sql: string, values?: unknown[]) => Promise<[RowDataPacket[], unknown]> },
  def: TablaMigracion,
  offset: number,
  limite: number
): Promise<{ filas: Record<string, unknown>[]; hayMas: boolean }> {
  const pk = def.pk
  const [resultado] = await mysql.query(
    `SELECT * FROM \`${def.mysql}\` ORDER BY \`${pk}\` ASC LIMIT ? OFFSET ?`,
    [limite + 1, offset]
  )
  const raw = resultado as RowDataPacket[]
  const hayMas = raw.length > limite
  const slice = hayMas ? raw.slice(0, limite) : raw
  const filas: Record<string, unknown>[] = []
  for (const f of slice) {
    filas.push(adaptarFilaParaDestino(def, serializarFilaMysql(f)))
  }
  return { filas, hayMas }
}

export async function cargarPksMysql(
  mysql: { query: (sql: string, values?: unknown[]) => Promise<[RowDataPacket[], unknown]> },
  def: TablaMigracion
): Promise<Set<number>> {
  const pk = def.pk
  const ids = new Set<number>()
  let offset = 0
  const pagina = 8000

  while (true) {
    const [resultado] = await mysql.query(
      `SELECT \`${pk}\` FROM \`${def.mysql}\` ORDER BY \`${pk}\` ASC LIMIT ? OFFSET ?`,
      [pagina, offset]
    )
    const rows = resultado as RowDataPacket[]
    if (!rows.length) break
    for (const f of rows) {
      const id = Number(f[pk])
      if (!Number.isNaN(id)) ids.add(id)
    }
    if (rows.length < pagina) break
    offset += pagina
  }

  return ids
}

export async function obtenerPksDestino(
  sb: AppDatabaseClient,
  tabla: string,
  pk: string
): Promise<Set<number>> {
  const ids = new Set<number>()
  let desde = 0
  const pagina = TABLAS_UPSERT_SIN_PRELECTURA.has(tabla) ? 400 : 800

  while (true) {
    await throttlePeticionDestino(tabla)

    let data: unknown[] | null = null
    let ultimoError: Error | null = null

    for (let intento = 1; intento <= MAX_REINTENTOS_DESTINO; intento++) {
      const res = await sb
        .from(tabla)
        .select(pk)
        .order(pk, { ascending: true })
        .range(desde, desde + pagina - 1)

      if (!res.error) {
        data = res.data
        ultimoError = null
        break
      }

      const msg = res.error.message ?? String(res.error)
      ultimoError = new Error(`No se pudieron leer PK de ${tabla}: ${msg}`)
      if (!esErrorTransitorioDestino(msg) || intento === MAX_REINTENTOS_DESTINO) {
        throw ultimoError
      }
      await esperaReintentoDestino(msg, intento)
      await throttlePeticionDestino(tabla)
    }

    if (ultimoError) throw ultimoError
    if (!data?.length) break

    for (const row of data) {
      const rec = row as unknown as Record<string, unknown>
      const id = Number(rec[pk])
      if (!Number.isNaN(id)) ids.add(id)
    }

    if (data.length < pagina) break
    desde += pagina
  }

  return ids
}

export async function obtenerFilasDestinoPorPks(
  sb: AppDatabaseClient,
  tabla: string,
  pk: string,
  pks: number[]
): Promise<Map<number, Record<string, unknown>>> {
  const mapa = new Map<number, Record<string, unknown>>()
  const lote = tamanoLoteLectura(tabla)

  for (let i = 0; i < pks.length; i += lote) {
    const slice = pks.slice(i, i + lote)
    let ultimoError: Error | null = null

    for (let intento = 1; intento <= MAX_REINTENTOS_DESTINO; intento++) {
      await throttlePeticionDestino(tabla)
      const { data, error } = await sb.from(tabla).select('*').in(pk, slice)
      if (!error) {
        for (const row of data ?? []) {
          const rec = row as Record<string, unknown>
          mapa.set(Number(rec[pk]), rec)
        }
        ultimoError = null
        break
      }

      const msg = error.message ?? String(error)
      ultimoError = new Error(`${tabla} lectura lote: ${msg}`)
      if (!esErrorTransitorioDestino(msg) || intento === MAX_REINTENTOS_DESTINO) {
        throw ultimoError
      }
      await esperaReintentoDestino(msg, intento)
    }

    if (ultimoError) throw ultimoError
  }
  return mapa
}
