import type { RowDataPacket } from 'mysql2'
import type { AppDatabaseClient } from '@/lib/dbTypes'
import { createMysqlLegacyConnection, getMysqlLegacyConfig } from './mysqlLegacy'
import { createSupabaseAdmin } from './supabaseAdmin'
import { TABLAS_MIGRACION, type TablaMigracion } from './migracionTablasManifest'
import {
  camposDistintosEntreFilas,
  filasIguales,
  leerFilasMysqlAdaptadas,
  obtenerFilasSupabasePorPks,
  obtenerPksSupabase,
} from './migracionTablasCompare'

const MUESTRA_PK_MAX = 20
const MUESTRA_DIFF_MAX = 10
const LOTE_COMPARE = 500

export interface MuestraDiffVerificacion {
  pk: number
  campos: string[]
}

export interface ResultadoTablaVerificacion {
  id: string
  supabase: string
  mysql: string
  etiqueta: string
  grupo: TablaMigracion['grupo']
  estado: 'ok' | 'discordancia' | 'omitida' | 'error'
  mensaje?: string
  mysqlCount: number
  supabaseCount: number
  comunes: number
  faltanEnSupabase: number
  sobranEnSupabase: number
  contenidoDistinto: number
  muestraFaltan: number[]
  muestraSobran: number[]
  muestraDistintas: MuestraDiffVerificacion[]
}

export interface ResultadoVerificacionEspejo {
  ok: boolean
  duracionMs: number
  mysql: { host: string; database: string; port: number }
  tablas: ResultadoTablaVerificacion[]
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

async function supabaseTablaDisponible(sb: AppDatabaseClient, tabla: string): Promise<boolean> {
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

async function aplicarFiltroMigracion(
  sb: AppDatabaseClient,
  def: TablaMigracion,
  mysqlMap: Map<number, Record<string, unknown>>
): Promise<{ mapa: Map<number, Record<string, unknown>>; mensaje?: string }> {
  if (def.id !== 'pago_interno_precio') {
    return { mapa: mysqlMap }
  }

  const conceptos = await obtenerPksSupabase(sb, 'concepto_interno', 'concepto_id')
  const antes = mysqlMap.size
  const filtrado = new Map<number, Record<string, unknown>>()
  for (const [id, fila] of mysqlMap) {
    if (conceptos.has(Number(fila.concepto_id))) filtrado.set(id, fila)
  }
  const omitidos = antes - filtrado.size
  const mensaje =
    omitidos > 0
      ? `${omitidos} fila(s) excluidas de la comparación (concepto_id sin catálogo en Supabase)`
      : undefined
  return { mapa: filtrado, mensaje }
}

async function verificarUnaTabla(
  sb: AppDatabaseClient,
  mysql: Awaited<ReturnType<typeof createMysqlLegacyConnection>>,
  def: TablaMigracion
): Promise<ResultadoTablaVerificacion> {
  const base: ResultadoTablaVerificacion = {
    id: def.id,
    supabase: def.supabase,
    mysql: def.mysql,
    etiqueta: def.etiqueta,
    grupo: def.grupo,
    estado: 'ok',
    mysqlCount: 0,
    supabaseCount: 0,
    comunes: 0,
    faltanEnSupabase: 0,
    sobranEnSupabase: 0,
    contenidoDistinto: 0,
    muestraFaltan: [],
    muestraSobran: [],
    muestraDistintas: [],
  }

  const existeMysql = await tablaExisteEnMysql(mysql, def.mysql)
  if (!existeMysql) {
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
      mensaje: `No existe en Supabase (${def.supabase})`,
    }
  }

  const pk = def.pk
  let mysqlMap = await leerFilasMysqlAdaptadas(mysql, def)
  const { mapa: mysqlFiltrado, mensaje: mensajeFiltro } = await aplicarFiltroMigracion(
    sb,
    def,
    mysqlMap
  )
  mysqlMap = mysqlFiltrado
  if (mensajeFiltro) base.mensaje = mensajeFiltro

  base.mysqlCount = mysqlMap.size

  const supabasePks = await obtenerPksSupabase(sb, def.supabase, pk)
  base.supabaseCount = supabasePks.size

  const mysqlPks = new Set(mysqlMap.keys())

  for (const id of mysqlPks) {
    if (!supabasePks.has(id)) {
      base.faltanEnSupabase++
      if (base.muestraFaltan.length < MUESTRA_PK_MAX) base.muestraFaltan.push(id)
    }
  }

  for (const id of supabasePks) {
    if (!mysqlPks.has(id)) {
      base.sobranEnSupabase++
      if (base.muestraSobran.length < MUESTRA_PK_MAX) base.muestraSobran.push(id)
    }
  }

  const idsComunes = [...mysqlPks].filter((id) => supabasePks.has(id))
  base.comunes = idsComunes.length

  for (let i = 0; i < idsComunes.length; i += LOTE_COMPARE) {
    const lote = idsComunes.slice(i, i + LOTE_COMPARE)
    const supabaseLote = await obtenerFilasSupabasePorPks(sb, def.supabase, pk, lote)

    for (const id of lote) {
      const filaMysql = mysqlMap.get(id)
      const filaSupabase = supabaseLote.get(id)
      if (!filaMysql || !filaSupabase) continue

      if (!filasIguales(filaMysql, filaSupabase)) {
        base.contenidoDistinto++
        if (base.muestraDistintas.length < MUESTRA_DIFF_MAX) {
          base.muestraDistintas.push({
            pk: id,
            campos: camposDistintosEntreFilas(filaMysql, filaSupabase),
          })
        }
      }
    }
  }

  const hayDiscordancia =
    base.faltanEnSupabase > 0 || base.sobranEnSupabase > 0 || base.contenidoDistinto > 0

  if (hayDiscordancia) {
    base.estado = 'discordancia'
    const partes: string[] = []
    if (base.faltanEnSupabase > 0) partes.push(`${base.faltanEnSupabase} PK faltan en Supabase`)
    if (base.sobranEnSupabase > 0) partes.push(`${base.sobranEnSupabase} PK sobran en Supabase`)
    if (base.contenidoDistinto > 0) {
      partes.push(`${base.contenidoDistinto} fila(s) con contenido distinto`)
    }
    const resumen = partes.join(' · ')
    base.mensaje = base.mensaje ? `${base.mensaje} · ${resumen}` : resumen
  } else if (base.mysqlCount !== base.supabaseCount) {
    base.estado = 'discordancia'
    base.mensaje =
      base.mensaje ??
      `Conteos distintos (MySQL esperado ${base.mysqlCount}, Supabase ${base.supabaseCount})`
  }

  return base
}

export async function ejecutarVerificacionEspejo(opciones: {
  tablas?: string[]
}): Promise<ResultadoVerificacionEspejo> {
  const inicio = Date.now()
  const cfg = getMysqlLegacyConfig()
  if (!cfg) {
    throw new Error('Falta configuración MySQL (MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD).')
  }

  const idsSeleccionados = opciones.tablas?.length ? new Set(opciones.tablas) : null
  const aVerificar = idsSeleccionados
    ? TABLAS_MIGRACION.filter((t) => idsSeleccionados.has(t.id))
    : TABLAS_MIGRACION

  const sb = createSupabaseAdmin()
  const mysql = await createMysqlLegacyConnection()
  const tablas: ResultadoTablaVerificacion[] = []
  const erroresGlobales: string[] = []

  try {
    for (const def of aVerificar) {
      try {
        tablas.push(await verificarUnaTabla(sb, mysql, def))
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
          mysqlCount: 0,
          supabaseCount: 0,
          comunes: 0,
          faltanEnSupabase: 0,
          sobranEnSupabase: 0,
          contenidoDistinto: 0,
          muestraFaltan: [],
          muestraSobran: [],
          muestraDistintas: [],
        })
        erroresGlobales.push(`${def.etiqueta}: ${msg}`)
      }
    }
  } finally {
    await mysql.end()
  }

  const conDiscordancia = tablas.some((t) => t.estado === 'discordancia')
  const conError = tablas.some((t) => t.estado === 'error')

  return {
    ok: !conDiscordancia && !conError && erroresGlobales.length === 0,
    duracionMs: Date.now() - inicio,
    mysql: { host: cfg.host, database: cfg.database, port: cfg.port },
    tablas,
    erroresGlobales,
  }
}
