import type { RowDataPacket } from 'mysql2'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createMysqlLegacyConnection,
  getMysqlLegacyConfig,
  getMysqlTableNames,
} from './mysqlLegacy'
import { createSupabaseAdmin } from './supabaseAdmin'

const LOTE = 250

function definicionTablas() {
  const mysqlTables = getMysqlTableNames()
  return [
    { mysql: mysqlTables.alumno, supabase: 'alumno' as const, pk: 'alumno_id' },
    {
      mysql: mysqlTables.alumno_detalles,
      supabase: 'alumno_detalles' as const,
      pk: 'detalle_id',
    },
    {
      mysql: mysqlTables.alumno_familiar,
      supabase: 'alumno_familiar' as const,
      pk: 'familiar_id',
    },
    {
      mysql: mysqlTables.alumno_contacto,
      supabase: 'alumno_contacto' as const,
      pk: 'contacto_id',
    },
    {
      mysql: mysqlTables.alumno_beca,
      supabase: 'alumno_beca' as const,
      pk: 'alumno_beca_id',
    },
  ]
}

async function comprobarTablasMysql(
  mysql: Awaited<ReturnType<typeof createMysqlLegacyConnection>>
) {
  const cfg = getMysqlLegacyConfig()
  const db = cfg?.database ?? 'winston_general'
  const esperadas = definicionTablas().map((t) => t.mysql)
  const [filas] = await mysql.query<RowDataPacket[]>(
    'SELECT TABLE_NAME AS nombre FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
    [db]
  )
  const existentes = new Set(filas.map((r) => String(r.nombre)))
  const faltan = esperadas.filter((t) => !existentes.has(t))
  if (faltan.length === 0) return

  const parecidas = [...existentes].filter((t) => /alumno|familiar|detalle/i.test(t))
  throw new Error(
    `En MySQL (${db}) no existen: ${faltan.join(', ')}. ` +
      `Tablas parecidas: ${parecidas.length ? parecidas.join(', ') : '(ninguna)'}. ` +
      '¿Estás en localhost vacío? Usa el host de phpMyAdmin real o importa un respaldo SQL.'
  )
}

const CAMPOS_SOLO_FECHA = new Set([
  'alumno_registro',
  'alumno_alta',
  'alumno_fecha_nac',
  'familiar_fecha_nac',
  'familiar_registro',
])

const CAMPOS_FECHA_HORA = new Set([
  'detalle_registro',
  'detalle_actualizacion',
  'alumno_actualizacion',
  'familiar_actualizacion',
  'contacto_actualizacion',
  'contacto_alta',
  'beca_registro',
  'beca_actualizacion',
])

function esFechaMysqlInvalidaTexto(texto: string): boolean {
  const s = texto.trim()
  return !s || s.startsWith('0000-00-00')
}

function fechaValida(d: Date): boolean {
  return !Number.isNaN(d.getTime())
}

function serializarValor(clave: string, valor: unknown): unknown {
  if (valor === undefined) return undefined
  if (valor === null) return null
  if (Buffer.isBuffer(valor)) return valor.toString('utf8')

  if (typeof valor === 'string' && (CAMPOS_SOLO_FECHA.has(clave) || CAMPOS_FECHA_HORA.has(clave))) {
    if (esFechaMysqlInvalidaTexto(valor)) return null
    return CAMPOS_SOLO_FECHA.has(clave) ? valor.trim().slice(0, 10) : valor.trim()
  }

  if (valor instanceof Date) {
    if (!fechaValida(valor)) return null
    if (CAMPOS_SOLO_FECHA.has(clave)) {
      return valor.toISOString().slice(0, 10)
    }
    if (CAMPOS_FECHA_HORA.has(clave)) {
      return valor.toISOString()
    }
    return valor.toISOString()
  }

  return valor
}

function serializarFila(fila: RowDataPacket): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [clave, valor] of Object.entries(fila)) {
    const v = serializarValor(clave, valor)
    if (v !== undefined) out[clave] = v
  }
  return out
}

async function vaciarTablasDestino(sb: SupabaseClient) {
  const orden: Array<{
    tabla: 'alumno' | 'alumno_detalles' | 'alumno_familiar' | 'alumno_contacto' | 'alumno_beca'
    pk: string
  }> = [
    { tabla: 'alumno_contacto', pk: 'contacto_id' },
    { tabla: 'alumno_familiar', pk: 'familiar_id' },
    { tabla: 'alumno_detalles', pk: 'detalle_id' },
    { tabla: 'alumno_beca', pk: 'alumno_beca_id' },
    { tabla: 'alumno', pk: 'alumno_id' },
  ]

  for (const { tabla, pk } of orden) {
    const { error } = await sb.from(tabla).delete().gte(pk, 0)
    if (error) throw new Error(`No se pudo vaciar ${tabla}: ${error.message}`)
  }
}

async function insertarEnLotes(
  sb: SupabaseClient,
  tabla: string,
  pk: string,
  filas: Record<string, unknown>[]
) {
  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE)
    const { error } = await sb.from(tabla).upsert(lote, { onConflict: pk })
    if (error) {
      throw new Error(`${tabla} (filas ${i + 1}–${i + lote.length}): ${error.message}`)
    }
  }
}

export interface ResultadoMigracionAlumno {
  ok: true
  duracionMs: number
  filas: {
    alumno: number
    alumno_detalles: number
    alumno_familiar: number
    alumno_contacto: number
    alumno_beca: number
  }
  validacion: {
    alumno_ref: number
    alumno_id: number | null
    alumno_clave: string | null
  } | null
}

export async function ejecutarMigracionAlumno(opciones: {
  vaciarDestino: boolean
}): Promise<ResultadoMigracionAlumno> {
  const inicio = Date.now()
  const sb = createSupabaseAdmin()
  const mysql = await createMysqlLegacyConnection()
  const filas = {
    alumno: 0,
    alumno_detalles: 0,
    alumno_familiar: 0,
    alumno_contacto: 0,
    alumno_beca: 0,
  }

  try {
    await comprobarTablasMysql(mysql)

    if (opciones.vaciarDestino) {
      await vaciarTablasDestino(sb)
    }

    const TABLAS = definicionTablas()
    for (const { mysql: nombreMysql, supabase, pk } of TABLAS) {
      const [resultado] = await mysql.query<RowDataPacket[]>(
        `SELECT * FROM \`${nombreMysql}\``
      )
      const serializadas = resultado.map((f) => serializarFila(f))
      await insertarEnLotes(sb, supabase, pk, serializadas)
      filas[supabase] = serializadas.length
    }

    const { data: alumnoFranco } = await sb
      .from('alumno')
      .select('alumno_id, alumno_ref')
      .eq('alumno_ref', 11779)
      .maybeSingle()

    let clave: string | null = null
    if (alumnoFranco?.alumno_id) {
      const { data: det } = await sb
        .from('alumno_detalles')
        .select('alumno_clave')
        .eq('alumno_id', alumnoFranco.alumno_id)
        .maybeSingle()
      clave = det?.alumno_clave ?? null
    }

    return {
      ok: true,
      duracionMs: Date.now() - inicio,
      filas,
      validacion: alumnoFranco
        ? {
            alumno_ref: Number(alumnoFranco.alumno_ref),
            alumno_id: alumnoFranco.alumno_id,
            alumno_clave: clave,
          }
        : null,
    }
  } finally {
    await mysql.end()
  }
}
