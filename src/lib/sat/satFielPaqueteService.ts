import type { AppDatabaseClient } from '@/lib/dbTypes'
import { crearFielDesdeUpload } from './satFiel'
import { cifrarSecretoFiel, descifrarSecretoFiel } from './satFielPaqueteCrypto'
import type { SatFielHandle } from './satFiel'

export type SatFielPaqueteResumen = {
  id: string
  nombre: string
  cerNombre: string
  keyNombre: string
  creadoEn: string
  actualizadoEn: string
  ultimoUsoEn: string | null
}

type SatFielPaqueteRow = {
  id: string
  nombre: string
  cer_base64: string
  key_base64: string
  cer_nombre: string
  key_nombre: string
  password_cifrado: string
  creado_por: string | null
  creado_en: string
  actualizado_en: string
  ultimo_uso_en: string | null
}

const RESUMEN_COLS =
  'id, nombre, cer_nombre, key_nombre, creado_en, actualizado_en, ultimo_uso_en'

function mapResumen(row: SatFielPaqueteRow): SatFielPaqueteResumen {
  return {
    id: row.id,
    nombre: row.nombre,
    cerNombre: row.cer_nombre,
    keyNombre: row.key_nombre,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
    ultimoUsoEn: row.ultimo_uso_en,
  }
}

export async function listarPaquetesFielServidor(
  db: AppDatabaseClient
): Promise<SatFielPaqueteResumen[]> {
  const { data, error } = await db
    .from('sat_fiel_paquete')
    .select(RESUMEN_COLS)
    .order('nombre', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as SatFielPaqueteRow[]).map(mapResumen)
}

export async function guardarPaqueteFielServidor(
  db: AppDatabaseClient,
  input: {
    nombre: string
    cer: Buffer
    key: Buffer
    cerNombre: string
    keyNombre: string
    password: string
    creadoPor?: string
    id?: string
  }
): Promise<SatFielPaqueteResumen> {
  const nombre = input.nombre.trim()
  if (!nombre) throw new Error('Indique un nombre para el paquete de e.firma.')
  if (!input.cer.length || !input.key.length) {
    throw new Error('Suba .cer y .key.')
  }
  if (!input.password.trim()) {
    throw new Error('Indique la contraseña de la e.firma.')
  }

  const payload = {
    nombre,
    cer_base64: input.cer.toString('base64'),
    key_base64: input.key.toString('base64'),
    cer_nombre: input.cerNombre.trim() || 'certificado.cer',
    key_nombre: input.keyNombre.trim() || 'clave.key',
    password_cifrado: cifrarSecretoFiel(input.password),
    creado_por: input.creadoPor ?? null,
  }

  if (input.id) {
    const { data, error } = await db
      .from('sat_fiel_paquete')
      .update(payload)
      .eq('id', input.id)
      .select(RESUMEN_COLS)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) throw new Error('Paquete no encontrado.')
    return mapResumen(data as SatFielPaqueteRow)
  }

  const { data, error } = await db
    .from('sat_fiel_paquete')
    .insert([payload])
    .select(RESUMEN_COLS)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('No se pudo guardar el paquete.')
  return mapResumen(data as SatFielPaqueteRow)
}

export async function eliminarPaqueteFielServidor(
  db: AppDatabaseClient,
  id: string
): Promise<void> {
  const { error } = await db.from('sat_fiel_paquete').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function cargarFielDesdePaqueteServidor(
  db: AppDatabaseClient,
  id: string
): Promise<SatFielHandle> {
  const { data, error } = await db
    .from('sat_fiel_paquete')
    .select(
      'id, cer_base64, key_base64, cer_nombre, key_nombre, password_cifrado'
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Paquete de e.firma no encontrado.')

  const row = data as SatFielPaqueteRow
  const password = descifrarSecretoFiel(row.password_cifrado)

  return crearFielDesdeUpload({
    cer: Buffer.from(row.cer_base64, 'base64'),
    key: Buffer.from(row.key_base64, 'base64'),
    password,
  })
}

export async function marcarUsoPaqueteFielServidor(
  db: AppDatabaseClient,
  id: string
): Promise<void> {
  const { error } = await db
    .from('sat_fiel_paquete')
    .update({ ultimo_uso_en: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}
