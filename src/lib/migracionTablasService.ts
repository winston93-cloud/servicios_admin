import type { RowDataPacket } from 'mysql2'
import type { AppDatabaseClient } from '@/lib/dbTypes'
import { createMysqlLegacyConnection, getMysqlLegacyConfig } from './mysqlLegacy'
import { createDbAdmin } from './insforgeAdmin'
import {
  TABLAS_MIGRACION,
  TABLAS_MIGRACION_ELIMINAR,
  TABLAS_VACIAR_ANTES,
  type TablaMigracion,
} from './migracionTablasManifest'
import {
  mensajeErrorDestino,
  sanitizarFilaDatosFacturacionUpsert,
} from './migracionTablasAdaptadores'
import {
  cargarPksMysql,
  filasIguales,
  leerFilasMysqlAdaptadas,
  leerFilasMysqlAdaptadasPagina,
  obtenerFilasDestinoPorPks,
  obtenerPksDestino,
  tamanoLoteMigracion,
  throttlePeticionDestino,
  usaUpsertSinPrelectura,
} from './migracionTablasCompare'

const LOTE_ELIMINAR_PK = 80

/** Upserts masivos (menos peticiones que lectura fila a fila). */
const LOTE_UPSERT_MASIVO: Partial<Record<string, number>> = {
  pago_detalle: 100,
  pago_interno: 120,
  pago_prorroga: 150,
  usuario: 150,
  alumno: 100,
  alumno_detalles: 100,
  alumno_beca: 120,
  alumno_familiar: 120,
  alumno_contacto: 120,
}

function loteUpsertMasivo(tabla: string): number {
  return LOTE_UPSERT_MASIVO[tabla] ?? 150
}

export type ModoMigracion = 'espejo' | 'solo_upsert' | 'vaciar_copiar'

export interface ResultadoTablaMigracion {
  id: string
  destino: string
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
  hayMasFilas?: boolean
  siguienteOffset?: number
}

export interface ResultadoMigracionTablas {
  ok: boolean
  duracionMs: number
  modo: ModoMigracion
  mysql: { host: string; database: string; port: number }
  tablas: ResultadoTablaMigracion[]
  erroresGlobales: string[]
  hayMasFilas?: boolean
  siguienteOffset?: number
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

async function destinoTablaDisponible(sb: AppDatabaseClient, tabla: string): Promise<boolean> {
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
  sb: AppDatabaseClient,
  tabla: string,
  pk: string
): Promise<Set<number>> {
  return obtenerPksDestino(sb, tabla, pk)
}

async function upsertLote(
  sb: AppDatabaseClient,
  tabla: string,
  pk: string,
  filas: Record<string, unknown>[]
) {
  if (!filas.length) return

  const payload =
    tabla === 'datos_facturacion'
      ? filas.map((fila) => sanitizarFilaDatosFacturacionUpsert(fila))
      : filas

  let ultimoError: Error | null = null
  for (let intento = 1; intento <= 6; intento++) {
    await throttlePeticionDestino(tabla)
    const { error } = await sb.from(tabla).upsert(payload, { onConflict: pk })
    if (!error) return

    const msg = mensajeErrorDestino(error)
    ultimoError = new Error(`${tabla} upsert: ${msg}`)
    const transitorio =
      msg.toLowerCase().includes('too many requests') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.includes('504') ||
      msg.includes('429')
    if (!transitorio || intento === 6) throw ultimoError
    const espera = msg.toLowerCase().includes('too many requests') ? 12_000 * intento : 800 * intento
    await new Promise((r) => setTimeout(r, Math.min(90_000, espera)))
  }
  if (ultimoError) throw ultimoError
}

async function vaciarTablaPorPk(
  sb: AppDatabaseClient,
  tabla: string,
  pk: string,
  tipo: 'entero' | 'uuid' | 'auto' = 'auto'
): Promise<void> {
  if (tipo === 'uuid') {
    const { error } = await sb
      .from(tabla)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) throw new Error(`No se pudo vaciar ${tabla}: ${error.message}`)
    return
  }

  const { error } = await sb.from(tabla).delete().gte(pk, 0)
  if (!error) return

  const msg = error.message?.toLowerCase() ?? ''
  if (
    tipo === 'auto' &&
    (msg.includes('uuid') || msg.includes('invalid input syntax') || msg.includes('integer'))
  ) {
    const { error: e2 } = await sb.from(tabla).delete().not(pk, 'is', null)
    if (!e2) return
    if (pk === 'id') {
      const { error: e3 } = await sb
        .from(tabla)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
      if (!e3) return
      throw new Error(`No se pudo vaciar ${tabla}: ${e3.message}`)
    }
    throw new Error(`No se pudo vaciar ${tabla}: ${e2.message}`)
  }

  throw new Error(`No se pudo vaciar ${tabla}: ${error.message}`)
}

async function vaciarTabla(sb: AppDatabaseClient, tabla: string, pk: string) {
  await vaciarTablaPorPk(sb, tabla, pk, 'auto')
}

/** Vacía tablas auxiliares (FK hacia padre) que no están en el manifiesto MySQL. */
async function vaciarTablasAuxiliares(sb: AppDatabaseClient, tablas: string[]) {
  for (const tabla of tablas) {
    const ok = await destinoTablaDisponible(sb, tabla)
    if (!ok) continue

    let vaciada = false
    for (const pk of ['id', 'contrato_id']) {
      try {
        await vaciarTablaPorPk(sb, tabla, pk, 'auto')
        vaciada = true
        break
      } catch (e) {
        const msg = e instanceof Error ? e.message.toLowerCase() : ''
        if (!msg.includes('column') && !msg.includes('does not exist')) {
          throw e
        }
      }
    }

    if (!vaciada) {
      throw new Error(`No se pudo vaciar ${tabla}: no se encontró PK compatible`)
    }
  }
}

/** Vacía tablas seleccionadas en orden inverso de dependencias (hijos → padres). */
export async function vaciarTablasMigracion(opciones: {
  tablas?: string[]
  mysql?: Awaited<ReturnType<typeof createMysqlLegacyConnection>>
}): Promise<{ ok: boolean; vaciadas: string[]; omitidas: string[]; errores: string[] }> {
  const idsSeleccionados = opciones.tablas?.length ? new Set(opciones.tablas) : null
  const aVaciar = TABLAS_MIGRACION_ELIMINAR.filter(
    (t) => !idsSeleccionados || idsSeleccionados.has(t.id)
  )

  let mysql = opciones.mysql
  let cerrarMysql = false
  if (!mysql) {
    mysql = await createMysqlLegacyConnection()
    cerrarMysql = true
  }

  const sb = createDbAdmin()
  const vaciadas: string[] = []
  const omitidas: string[] = []
  const errores: string[] = []

  try {
    for (const def of aVaciar) {
      if (def.soloInsforge) {
        omitidas.push(def.destino)
        continue
      }

      const existeMysql = await tablaExisteEnMysql(mysql, def.mysql)
      if (!existeMysql) {
        omitidas.push(def.destino)
        continue
      }

      const auxiliares = TABLAS_VACIAR_ANTES[def.id]
      if (auxiliares?.length) {
        try {
          await vaciarTablasAuxiliares(sb, auxiliares)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Error desconocido'
          errores.push(msg)
          continue
        }
      }

      const destinoOk = await destinoTablaDisponible(sb, def.destino)
      if (!destinoOk) continue

      try {
        await vaciarTabla(sb, def.destino, def.pk)
        vaciadas.push(def.destino)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error desconocido'
        errores.push(`${def.etiqueta}: ${msg}`)
      }
    }
  } finally {
    if (cerrarMysql) await mysql.end()
  }

  return { ok: errores.length === 0, vaciadas, omitidas, errores }
}

async function eliminarHuérfanos(
  sb: AppDatabaseClient,
  tabla: string,
  pk: string,
  pksOrigen: Set<number>
): Promise<{ eliminados: number; advertencia?: string }> {
  const pksDestino = await obtenerPksDestino(sb, tabla, pk)
  const aEliminar = [...pksDestino].filter((id) => !pksOrigen.has(id))
  if (aEliminar.length === 0) return { eliminados: 0 }

  let eliminados = 0
  const fallidos: number[] = []

  for (let i = 0; i < aEliminar.length; i += LOTE_ELIMINAR_PK) {
    const slice = aEliminar.slice(i, i + LOTE_ELIMINAR_PK)
    await throttlePeticionDestino(tabla)
    const { error } = await sb.from(tabla).delete().in(pk, slice)
    if (!error) {
      eliminados += slice.length
      continue
    }

    const msg = error.message ?? ''
    const esFk =
      /foreign key|violates foreign|restrict|referencia/i.test(msg) ||
      /23503/.test(msg)

    if (!esFk) {
      throw new Error(`${tabla} eliminar huérfanos: ${msg}`)
    }

    // FK: intentar uno a uno y saltar los que sigan referenciados
    for (const id of slice) {
      await throttlePeticionDestino(tabla)
      const { error: e1 } = await sb.from(tabla).delete().eq(pk, id)
      if (e1) fallidos.push(id)
      else eliminados++
    }
  }

  if (fallidos.length > 0) {
    return {
      eliminados,
      advertencia: `${fallidos.length} huérfano(s) no eliminados (siguen referenciados, p. ej. pagos)`,
    }
  }
  return { eliminados }
}

async function migrarUnaTabla(
  sb: AppDatabaseClient,
  mysql: Awaited<ReturnType<typeof createMysqlLegacyConnection>>,
  def: TablaMigracion,
  modo: ModoMigracion,
  opciones?: {
    omitirVaciar?: boolean
    offsetFilas?: number
    limiteFilas?: number
    omitirHuérfanos?: boolean
    soloHuérfanos?: boolean
  }
): Promise<ResultadoTablaMigracion> {
  const base: ResultadoTablaMigracion = {
    id: def.id,
    destino: def.destino,
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

  if (def.soloInsforge) {
    return {
      ...base,
      estado: 'omitida',
      mensaje: 'Solo en InsForge (no forma parte de la migración desde phpMyAdmin)',
    }
  }

  const existe = await tablaExisteEnMysql(mysql, def.mysql)
  if (!existe) {
    return {
      ...base,
      estado: 'omitida',
      mensaje: `No existe en MySQL (${def.mysql})`,
    }
  }

  const destinoOk = await destinoTablaDisponible(sb, def.destino)
  if (!destinoOk) {
    return {
      ...base,
      estado: 'omitida',
      mensaje: `No existe en InsForge (${def.destino}); aplica el esquema en migrations/`,
    }
  }

  const pk = def.pk

  if (opciones?.soloHuérfanos) {
    if (modo !== 'espejo') {
      return { ...base, mensaje: 'Limpieza de huérfanos solo aplica en modo espejo' }
    }
    const pksOrigen = await cargarPksMysql(mysql, def)
    const limpia = await eliminarHuérfanos(sb, def.destino, pk, pksOrigen)
    base.eliminados = limpia.eliminados
    base.mensaje = `${base.eliminados} huérfano(s) eliminado(s) en InsForge`
    if (limpia.advertencia) {
      base.mensaje += ` · ${limpia.advertencia}`
    }
    return base
  }

  let filas: Record<string, unknown>[]
  let hayMasChunk = false

  if (opciones?.limiteFilas != null && opciones.limiteFilas > 0) {
    const offset = opciones.offsetFilas ?? 0
    const pagina = await leerFilasMysqlAdaptadasPagina(
      mysql,
      def,
      offset,
      opciones.limiteFilas
    )
    filas = pagina.filas
    hayMasChunk = pagina.hayMas
    base.hayMasFilas = hayMasChunk
    base.siguienteOffset = offset + filas.length
  } else {
    filas = await leerFilasMysql(mysql, def.mysql, def)
  }

  base.origen = filas.length

  if (def.id === 'pago_interno_precio') {
    const conceptos = await cargarIdsReferencia(sb, 'concepto_interno', 'concepto_id')
    const antes = filas.length
    filas = filas.filter((f) => conceptos.has(Number(f.concepto_id)))
    const omitidos = antes - filas.length
    if (omitidos > 0) {
      base.mensaje = `${omitidos} fila(s) omitidas (concepto_id sin catálogo en InsForge)`
    }
  }

  const lote = tamanoLoteMigracion(def.destino)
  const sinPrelectura = usaUpsertSinPrelectura(def.destino, filas.length)

  if (modo === 'vaciar_copiar') {
    if (!opciones?.omitirVaciar) {
      const auxiliares = TABLAS_VACIAR_ANTES[def.id]
      if (auxiliares?.length) {
        await vaciarTablasAuxiliares(sb, auxiliares)
      }
      await vaciarTabla(sb, def.destino, pk)
    }
    for (let i = 0; i < filas.length; i += lote) {
      await upsertLote(sb, def.destino, pk, filas.slice(i, i + lote))
    }
    base.insertados = filas.length
    return base
  }

  const pksOrigen = new Set<number>()
  for (const f of filas) {
    const id = Number(f[pk])
    if (!Number.isNaN(id)) pksOrigen.add(id)
  }

  if (sinPrelectura) {
    const loteUpsert = loteUpsertMasivo(def.destino)
    for (let i = 0; i < filas.length; i += loteUpsert) {
      await upsertLote(sb, def.destino, pk, filas.slice(i, i + loteUpsert))
    }
    base.insertados = filas.length
    base.mensaje =
      'Upsert masivo sin lectura previa (tabla grande; evita rate limit de InsForge). Usa Verificar espejo para auditar.'
  } else {
    for (let i = 0; i < filas.length; i += lote) {
      const loteFilas = filas.slice(i, i + lote)
      const pksLote = loteFilas
        .map((f) => Number(f[pk]))
        .filter((id) => !Number.isNaN(id))

      const existentes = await obtenerFilasDestinoPorPks(sb, def.destino, pk, pksLote)
      const aUpsert: Record<string, unknown>[] = []

      for (const fila of loteFilas) {
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
        await upsertLote(sb, def.destino, pk, aUpsert)
      }
    }
  }

  if (modo === 'espejo' && !opciones?.omitirHuérfanos && !hayMasChunk) {
    try {
      const limpia = await eliminarHuérfanos(sb, def.destino, pk, pksOrigen)
      base.eliminados = limpia.eliminados
      if (limpia.advertencia) {
        base.mensaje = (base.mensaje ? `${base.mensaje} · ` : '') + limpia.advertencia
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al limpiar huérfanos'
      // Los upserts ya corrieron; no tumbar toda la tabla por FK en huérfanos.
      base.mensaje = (base.mensaje ? `${base.mensaje} · ` : '') + `Huérfanos: ${msg}`
    }
  } else if (modo === 'espejo' && hayMasChunk) {
    const parte = (base.mensaje ? `${base.mensaje} · ` : '') + 'Trozo de datos (huérfanos al final)'
    base.mensaje = parte
  }

  return base
}

export async function ejecutarMigracionTablas(opciones: {
  modo?: ModoMigracion
  tablas?: string[]
  /** En vaciar_copiar: 'vaciar' solo borra (hijos→padres); 'copiar' solo inserta. */
  faseVaciarCopiar?: 'vaciar' | 'copiar'
  offsetFilas?: number
  limiteFilas?: number
  /** Tras todos los trozos en espejo: eliminar PKs que no están en MySQL. */
  soloHuérfanos?: boolean
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

  if (modo === 'vaciar_copiar' && opciones.faseVaciarCopiar === 'vaciar') {
    const r = await vaciarTablasMigracion({ tablas: opciones.tablas })
    return {
      ok: r.ok,
      duracionMs: Date.now() - inicio,
      modo,
      mysql: { host: cfg.host, database: cfg.database, port: cfg.port },
      tablas: [],
      erroresGlobales: r.errores,
    }
  }

  const omitirVaciar = modo === 'vaciar_copiar' && opciones.faseVaciarCopiar === 'copiar'

  const sb = createDbAdmin()
  const mysql = await createMysqlLegacyConnection()
  const tablas: ResultadoTablaMigracion[] = []
  const erroresGlobales: string[] = []
  let vaciarBatchHecho = false

  try {
    if (modo === 'vaciar_copiar' && !opciones.faseVaciarCopiar && aMigrar.length > 1) {
      const rVaciar = await vaciarTablasMigracion({
        tablas: opciones.tablas ?? aMigrar.map((t) => t.id),
        mysql,
      })
      if (rVaciar.errores.length) {
        erroresGlobales.push(...rVaciar.errores)
      }
      vaciarBatchHecho = true
    }

    const omitirVaciarEnTabla =
      modo === 'vaciar_copiar' && (omitirVaciar || vaciarBatchHecho)

    for (const def of aMigrar) {
      try {
        const omitirHuérfanos =
          opciones.limiteFilas != null && !opciones.soloHuérfanos

        tablas.push(
          await migrarUnaTabla(sb, mysql, def, modo, {
            omitirVaciar: omitirVaciarEnTabla,
            offsetFilas: opciones.offsetFilas,
            limiteFilas: opciones.limiteFilas,
            omitirHuérfanos,
            soloHuérfanos: opciones.soloHuérfanos,
          })
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error desconocido'
        tablas.push({
          id: def.id,
          destino: def.destino,
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

  const ultima = tablas[tablas.length - 1]

  return {
    ok: erroresGlobales.length === 0,
    duracionMs: Date.now() - inicio,
    modo,
    mysql: { host: cfg.host, database: cfg.database, port: cfg.port },
    tablas,
    erroresGlobales,
    hayMasFilas: ultima?.hayMasFilas,
    siguienteOffset: ultima?.siguienteOffset,
  }
}

/** Compatibilidad con API anterior (solo tablas alumno). */
export async function ejecutarMigracionAlumno(opciones: { vaciarDestino: boolean }) {
  const modo: ModoMigracion = opciones.vaciarDestino ? 'vaciar_copiar' : 'solo_upsert'
  const ids = ['alumno', 'alumno_detalles', 'alumno_familiar', 'alumno_contacto', 'alumno_beca']
  const r = await ejecutarMigracionTablas({ modo, tablas: ids })
  const mapa = Object.fromEntries(r.tablas.map((t) => [t.destino, t])) as Record<
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
