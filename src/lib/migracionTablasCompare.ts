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

const LOTE_PK = 500

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
  mysql: { query: (sql: string) => Promise<[RowDataPacket[], unknown]> },
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

export async function obtenerPksDestino(
  sb: AppDatabaseClient,
  tabla: string,
  pk: string
): Promise<Set<number>> {
  const ids = new Set<number>()
  let desde = 0
  const pagina = 1000

  while (true) {
    const { data, error } = await sb
      .from(tabla)
      .select(pk)
      .order(pk, { ascending: true })
      .range(desde, desde + pagina - 1)

    if (error) throw new Error(`No se pudieron leer PK de ${tabla}: ${error.message}`)
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
  for (let i = 0; i < pks.length; i += LOTE_PK) {
    const slice = pks.slice(i, i + LOTE_PK)
    const { data, error } = await sb.from(tabla).select('*').in(pk, slice)
    if (error) throw new Error(`${tabla} lectura lote: ${error.message}`)
    for (const row of data ?? []) {
      const rec = row as Record<string, unknown>
      mapa.set(Number(rec[pk]), rec)
    }
  }
  return mapa
}
