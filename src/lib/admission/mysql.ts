/**
 * Conexión a MySQL (PHPMyAdmin en hosting)
 * Base de datos: winston_general
 * Tabla: alumno
 */

import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null
let alumnoRequiredDefaultsCache: Record<string, unknown> | null = null

function normalizeAlumnoText(input: string): string {
  // Requisito legacy (PHPMyAdmin / tabla alumno): MAYÚSCULAS y sin acentos/diacríticos.
  // También normalizamos espacios para evitar duplicados por diferencias de formato.
  return (input ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // diacríticos
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

export function getMySQLPool() {
  if (!pool) {
    const host = process.env.MYSQL_HOST
    const user = process.env.MYSQL_USER
    const password = process.env.MYSQL_PASSWORD
    const database = process.env.MYSQL_DATABASE

    if (!host || !user || !password || !database) {
      console.error('[MySQL] Faltan variables de entorno de MySQL')
      throw new Error('MySQL credentials not configured')
    }

    pool = mysql.createPool({
      host,
      user,
      password,
      database,
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    })
  }
  return pool
}

function defaultForMysqlDataType(dataType: string): unknown {
  const t = dataType.toLowerCase()
  if (['int', 'tinyint', 'smallint', 'mediumint', 'bigint', 'decimal', 'float', 'double', 'bit'].includes(t)) {
    return 0
  }
  if (['date', 'datetime', 'timestamp'].includes(t)) {
    return new Date()
  }
  return ''
}

/**
 * Columnas NOT NULL sin DEFAULT en `alumno` (servidor MariaDB estricto tras migración).
 * Evita errores tipo "Field 'mes' doesn't have a default value".
 */
async function getAlumnoRequiredColumnDefaults(): Promise<Record<string, unknown>> {
  if (alumnoRequiredDefaultsCache) return alumnoRequiredDefaultsCache

  const pool = getMySQLPool()
  const db = process.env.MYSQL_DATABASE || 'winston_general'
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COLUMN_NAME, DATA_TYPE, EXTRA
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'alumno'
       AND IS_NULLABLE = 'NO'
       AND COLUMN_DEFAULT IS NULL
       AND EXTRA NOT LIKE '%auto_increment%'`,
    [db]
  )

  const defaults: Record<string, unknown> = {}
  for (const row of rows) {
    const name = row.COLUMN_NAME as string
    defaults[name] = defaultForMysqlDataType(String(row.DATA_TYPE))
  }

  alumnoRequiredDefaultsCache = defaults
  return defaults
}

/** 0 = sin grupo asignado; en SA suelen usarse 1, 2 o 3. */
function parseAlumnoGrupo(value?: string): number {
  if (value == null || String(value).trim() === '') return 0
  const n = parseInt(String(value).trim(), 10)
  if (n >= 1 && n <= 3) return n
  return 0
}

export type AlumnoData = {
  alumno_app: string // Apellido paterno
  alumno_apm: string // Apellido materno
  alumno_nombre: string // Nombre completo
  alumno_nivel: string // 1= Maternal, 2= Kinder, 3= Primaria, 4= Secundaria
  alumno_grado: string // Grado dentro del nivel
  alumno_grupo?: string // 0 = sin grupo; 1, 2 o 3 cuando ya está asignado en SA
  alumno_status: string // 0= Baja General, 1= Activo, 2= Inactivo, 3= Baja Temporal Administrativa, 4= Bloqueado por Psicología
  alumno_nuevo_ingreso: string // 0= Reingreso, 1= Nuevo Ingreso de Agenda
  alumno_ciclo_escolar: string // Ej: "2015 - 2016"
  alumno_registro?: string // Fecha de alta (se pone automáticamente)
  alumno_alta?: string // Fecha de alta de inscripción
}

/**
 * Obtiene el siguiente alumno_ref disponible (último + 1)
 */
export async function getNextAlumnoRef(): Promise<number> {
  const pool = getMySQLPool()
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT MAX(alumno_ref) as max_ref FROM alumno'
  )
  const maxRef = rows[0]?.max_ref || 0
  return maxRef + 1
}

/**
 * Crea un nuevo alumno en la tabla MySQL
 * Retorna el alumno_ref asignado
 */
export async function createAlumnoInMySQL(data: AlumnoData): Promise<number> {
  const pool = getMySQLPool()
  const alumno_ref = await getNextAlumnoRef()
  const requiredDefaults = await getAlumnoRequiredColumnDefaults()

  const insertData = {
    ...requiredDefaults,
    alumno_ref,
    alumno_app: normalizeAlumnoText(data.alumno_app || ''),
    alumno_apm: normalizeAlumnoText(data.alumno_apm || ''),
    alumno_nombre: normalizeAlumnoText(data.alumno_nombre || ''),
    alumno_nivel: data.alumno_nivel || '',
    alumno_grado: data.alumno_grado || '',
    alumno_grupo: parseAlumnoGrupo(data.alumno_grupo),
    alumno_status: data.alumno_status || '2',
    alumno_nuevo_ingreso: data.alumno_nuevo_ingreso || '1',
    alumno_ciclo_escolar: data.alumno_ciclo_escolar || '',
    alumno_registro: new Date(),
    alumno_alta: data.alumno_alta || new Date(),
  }

  await pool.query('INSERT INTO alumno SET ?', [insertData])

  console.log('[MySQL] Alumno creado con ref:', alumno_ref)
  return alumno_ref
}

/**
 * Verifica si un alumno ya existe por nombre y apellido paterno
 */
export async function checkAlumnoExists(nombre: string, apellido: string): Promise<number | null> {
  const pool = getMySQLPool()
  const nombreNorm = normalizeAlumnoText(nombre || '')
  const apellidoNorm = normalizeAlumnoText(apellido || '')
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT alumno_ref FROM alumno WHERE alumno_nombre = ? AND alumno_app = ? LIMIT 1',
    [nombreNorm, apellidoNorm]
  )
  return rows[0]?.alumno_ref || null
}
