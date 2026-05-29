import type { RowDataPacket } from 'mysql2'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createMysqlLegacyConnection, getMysqlLegacyConfig } from './mysqlLegacy'
import { createSupabaseAdmin } from './supabaseAdmin'
import { TABLAS_MIGRACION, type TablaMigracion } from './migracionTablasManifest'
import { mensajeErrorSupabase } from './migracionTablasAdaptadores'
import {
  filasIguales,
  leerFilasMysqlAdaptadas,
  obtenerFilasSupabasePorPks,
  obtenerPksSupabase,
} from './migracionTablasCompare'

const LOTE = 200
const LOTE_PK = 500

export type ModoMigracion = 'espejo' | 'solo_upsert' | 'vaciar_copiar'

export interface ResultadoTablaMigracion {
  id: string
  supabase: string
  mysql: string
  etiqueta: string
  grupo: TablaMigracion['grupo']
  estado: 'ok' | 'omitida' | 'error'
  mensaje?: string
  origen: number
  insertados: number
  actualizados: number
  sinCambios: number
  eliminados: number
}

export interface ResultadoMigracionTablas {
  ok: boolean
  duracionMs: number
  modo: ModoMigracion
  mysql: { host: string; database: string; port: number }
  tablas: ResultadoTablaMigracion[]
  erroresGlobales: string[]
}

async function tablaExisteEnMysql(
  mysql: Awaited<ReturnType<typeof createMysqlLegacyConnection>>,
  nombre: string
): Promise<boolean> {
  const cfg = getMysqlLegacyConfig()
  const db = cfg?.database ?? 'winston_general'
  const [filas] = await mysql.query<RowDataPacket[]>(
    'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1',
    [db, nombre]
  )
  return filas.length > 0
}

async function leerFilasMysql(
  mysql: Awaited<ReturnType<typeof createMysqlLegacyConnection>>,
  nombreMysql: string,
  def: TablaMigracion
): Promise<Record<string, unknown>[]> {
  const mapa = await leerFilasMysqlAdaptadas(mysql, def)
  return [...mapa.values()]
}

async function supabaseTablaDisponible(sb: SupabaseClient, tabla: string): Promise<boolean> {
  const { error } = await sb.from(tabla).select('*').limit(0)
  if (!error) return true
  const msg = error.message?.toLowerCase() ?? ''
  if (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    error.code === 'PGRST205' ||
    error.code === '42P01'
  ) {
    return false
  }
  return true
}

async function cargarIdsReferencia(
  sb: SupabaseClient,
  tabla: string,
  pk: string
): Promise<Set<number>> {
  return obtenerPksSupabase(sb, tabla, pk)
}

async function upsertLote(
  sb: SupabaseClient,
  tabla: string,
  pk: string,
  filas: Record<string, unknown>[]
) {
  const { error } = await sb.from(tabla).upsert(filas, { onConflict: pk })
  if (error) throw new Error(`${tabla} upsert: ${mensajeErrorSupabase(error)}`)
}

async function vaciarTabla(sb: SupabaseClient, tabla: string, pk: string) {
  const { error } = await sb.from(tabla).delete().gte(pk, 0)
  if (error) throw new Error(`No se pudo vaciar ${tabla}: ${error.message}`)
}

async function eliminarHuérfanos(
  sb: SupabaseClient,
  tabla: string,
  pk: string,
  pksOrigen: Set<number>
): Promise<number> {
  const pksDestino = await obtenerPksSupabase(sb, tabla, pk)
  const aEliminar = [...pksDestino].filter((id) => !pksOrigen.has(id))
  if (aEliminar.length === 0) return 0

  for (let i = 0; i < aEliminar.length; i += LOTE_PK) {
    const slice = aEliminar.slice(i, i + LOTE_PK)
    const { error } = await sb.from(tabla).delete().in(pk, slice)
    if (error) throw new Error(`${tabla} eliminar huérfanos: ${error.message}`)
  }
  return aEliminar.length
}

async function migrarUnaTabla(
  sb: SupabaseClient,
  mysql: Awaited<ReturnType<typeof createMysqlLegacyConnection>>,
  def: TablaMigracion,
  modo: ModoMigracion
): Promise<ResultadoTablaMigracion> {
  const base: ResultadoTablaMigracion = {
    id: def.id,
    supabase: def.supabase,
    mysql: def.mysql,
    etiqueta: def.etiqueta,
    grupo: def.grupo,
    estado: 'ok',
    origen: 0,
    insertados: 0,
    actualizados: 0,
    sinCambios: 0,
    eliminados: 0,
  }

  const existe = await tablaExisteEnMysql(mysql, def.mysql)
  if (!existe) {
    return {
      ...base,
      estado: 'omitida',
      mensaje: `No existe en MySQL (${def.mysql})`,
    }
  }

  const supabaseOk = await supabaseTablaDisponible(sb, def.supabase)
  if (!supabaseOk) {
    return {
      ...base,
      estado: 'omitida',
      mensaje: `No existe en Supabase (${def.supabase}); ejecuta el SQL correspondiente en sql/`,
    }
  }

  /** PK en Supabase (no usar el nombre legacy de MySQL, ej. porroga_id). */
  const pk = def.pk

  let filas = await leerFilasMysql(mysql, def.mysql, def)
  base.origen = filas.length

  if (def.id === 'pago_interno_precio') {
    const conceptos = await cargarIdsReferencia(sb, 'concepto_interno', 'concepto_id')
    const antes = filas.length
    filas = filas.filter((f) => conceptos.has(Number(f.concepto_id)))
    const omitidos = antes - filas.length
    if (omitidos > 0) {
      base.mensaje = `${omitidos} fila(s) omitidas (concepto_id sin catálogo en Supabase)`
    }
  }

  if (modo === 'vaciar_copiar') {
    await vaciarTabla(sb, def.supabase, pk)
    for (let i = 0; i < filas.length; i += LOTE) {
      await upsertLote(sb, def.supabase, pk, filas.slice(i, i + LOTE))
    }
    base.insertados = filas.length
    return base
  }

  const pksOrigen = new Set<number>()
  for (const f of filas) {
    const id = Number(f[pk])
    if (!Number.isNaN(id)) pksOrigen.add(id)
  }

  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE)
    const pksLote = lote
      .map((f) => Number(f[pk]))
      .filter((id) => !Number.isNaN(id))

    const existentes = await obtenerFilasSupabasePorPks(sb, def.supabase, pk, pksLote)
    const aUpsert: Record<string, unknown>[] = []

    for (const fila of lote) {
      const id = Number(fila[pk])
      const prev = existentes.get(id)
      if (!prev) {
        base.insertados++
        aUpsert.push(fila)
      } else if (filasIguales(fila, prev)) {
        base.sinCambios++
      } else {
        base.actualizados++
        aUpsert.push(fila)
      }
    }

    if (aUpsert.length > 0) {
      await upsertLote(sb, def.supabase, pk, aUpsert)
    }
  }

  if (modo === 'espejo') {
    base.eliminados = await eliminarHuérfanos(sb, def.supabase, pk, pksOrigen)
  }

  return base
}

export async function ejecutarMigracionTablas(opciones: {
  modo?: ModoMigracion
  tablas?: string[]
}): Promise<ResultadoMigracionTablas> {
  const inicio = Date.now()
  const cfg = getMysqlLegacyConfig()
  if (!cfg) {
    throw new Error('Falta configuración MySQL (MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD).')
  }

  const modo = opciones.modo ?? 'espejo'
  const idsSeleccionados = opciones.tablas?.length
    ? new Set(opciones.tablas)
    : null

  const aMigrar = idsSeleccionados
    ? TABLAS_MIGRACION.filter((t) => idsSeleccionados.has(t.id))
    : TABLAS_MIGRACION

  const sb = createSupabaseAdmin()
  const mysql = await createMysqlLegacyConnection()
  const tablas: ResultadoTablaMigracion[] = []
  const erroresGlobales: string[] = []

  try {
    for (const def of aMigrar) {
      try {
        tablas.push(await migrarUnaTabla(sb, mysql, def, modo))
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error desconocido'
        tablas.push({
          id: def.id,
          supabase: def.supabase,
          mysql: def.mysql,
          etiqueta: def.etiqueta,
          grupo: def.grupo,
          estado: 'error',
          mensaje: msg,
          origen: 0,
          insertados: 0,
          actualizados: 0,
          sinCambios: 0,
          eliminados: 0,
        })
        erroresGlobales.push(`${def.etiqueta}: ${msg}`)
      }
    }
  } finally {
    await mysql.end()
  }

  return {
    ok: erroresGlobales.length === 0,
    duracionMs: Date.now() - inicio,
    modo,
    mysql: { host: cfg.host, database: cfg.database, port: cfg.port },
    tablas,
    erroresGlobales,
  }
}

/** Compatibilidad con API anterior (solo tablas alumno). */
export async function ejecutarMigracionAlumno(opciones: { vaciarDestino: boolean }) {
  const modo: ModoMigracion = opciones.vaciarDestino ? 'vaciar_copiar' : 'solo_upsert'
  const ids = ['alumno', 'alumno_detalles', 'alumno_familiar', 'alumno_contacto', 'alumno_beca']
  const r = await ejecutarMigracionTablas({ modo, tablas: ids })
  const mapa = Object.fromEntries(r.tablas.map((t) => [t.supabase, t])) as Record<
    string,
    ResultadoTablaMigracion
  >
  return {
    ok: r.ok,
    duracionMs: r.duracionMs,
    filas: {
      alumno: mapa.alumno?.origen ?? 0,
      alumno_detalles: mapa.alumno_detalles?.origen ?? 0,
      alumno_familiar: mapa.alumno_familiar?.origen ?? 0,
      alumno_contacto: mapa.alumno_contacto?.origen ?? 0,
      alumno_beca: mapa.alumno_beca?.origen ?? 0,
    },
    detalle: r.tablas,
    validacion: null,
  }
}
