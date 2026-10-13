import { createBoletasDb } from './boletasInsforge'
import { esGradoKinderEs, type KinderEsGrado, type KinderEsIndicador } from './boletasKinderEsCatalog'

const TABLA = 'boleta_kinder_es_indicador'
export const TABLA_CALIFICACIONES_KINDER_ES = 'boleta_calificacion_kinder_es'

const COLS = 'grado, indicador_id, nombre, orden, activo'

function mapRow(r: Record<string, unknown>): KinderEsIndicador {
  return {
    id: Number(r.indicador_id),
    grado: Number(r.grado) as KinderEsGrado,
    nombre: String(r.nombre ?? ''),
    orden: Number(r.orden ?? 0),
    activo: Boolean(r.activo),
  }
}

export async function listarIndicadoresKinderEs(): Promise<KinderEsIndicador[]> {
  const { data, error } = await createBoletasDb()
    .from(TABLA)
    .select(COLS)
    .order('grado')
    .order('orden')
    .order('indicador_id')
  if (error) throw new Error(`Catálogo Kinder Español: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow)
}

export async function indicadoresActivosKinderEs(grado: KinderEsGrado): Promise<KinderEsIndicador[]> {
  const { data, error } = await createBoletasDb()
    .from(TABLA)
    .select(COLS)
    .eq('grado', grado)
    .eq('activo', true)
    .order('orden')
    .order('indicador_id')
  if (error) throw new Error(`Catálogo Kinder Español: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow)
}

function validarGrado(grado: unknown): KinderEsGrado {
  const g = Number(grado)
  if (!esGradoKinderEs(g)) throw new Error('Grado inválido (K1 a K3).')
  return g
}

async function siguienteId(): Promise<number> {
  const { data, error } = await createBoletasDb()
    .from(TABLA)
    .select('indicador_id')
    .order('indicador_id', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  return Number((data?.[0] as Record<string, unknown> | undefined)?.indicador_id ?? 0) + 1
}

async function siguienteOrden(grado: KinderEsGrado): Promise<number> {
  const { data } = await createBoletasDb()
    .from(TABLA)
    .select('orden')
    .eq('grado', grado)
    .order('orden', { ascending: false })
    .limit(1)
  return Number((data?.[0] as Record<string, unknown> | undefined)?.orden ?? 0) + 1
}

export async function guardarIndicadorKinderEs(input: {
  grado: unknown
  id?: unknown
  nombre: unknown
  orden?: unknown
  activo?: unknown
}): Promise<KinderEsIndicador> {
  const grado = validarGrado(input.grado)
  const nombre = String(input.nombre ?? '').trim().replace(/\s+/g, ' ')
  if (!nombre) throw new Error('Escribe el nombre.')
  if (nombre.length > 120) throw new Error('El nombre es muy largo (máximo 120).')
  const idPrevio = Number(input.id)
  const esNuevo = !(Number.isInteger(idPrevio) && idPrevio > 0)

  const db = createBoletasDb()
  if (!esNuevo) {
    const { data } = await db
      .from(TABLA)
      .select('indicador_id')
      .eq('grado', grado)
      .eq('indicador_id', idPrevio)
      .limit(1)
    if (!data?.length) throw new Error('Ese campo ya no existe; recarga la página.')
  }

  const ordenRaw = Number(input.orden)
  const fila = {
    grado,
    indicador_id: esNuevo ? await siguienteId() : idPrevio,
    nombre,
    orden: Number.isInteger(ordenRaw) && ordenRaw > 0 ? Math.min(ordenRaw, 999) : await siguienteOrden(grado),
    activo: input.activo !== false,
    updated_at: new Date().toISOString(),
  }
  const { error } = await db.from(TABLA).upsert([fila], { onConflict: 'grado,indicador_id' })
  if (error) throw new Error(`Guardar campo: ${error.message}`)
  return mapRow(fila)
}

/** Borra solo si nadie lo ha calificado; si ya tiene calificaciones, hay que desactivarlo. */
export async function eliminarIndicadorKinderEs(input: { grado: unknown; id: unknown }): Promise<void> {
  const grado = validarGrado(input.grado)
  const id = Number(input.id)
  if (!Number.isInteger(id) || id <= 0) throw new Error('Campo inválido.')
  const db = createBoletasDb()
  const { data: usados, error: errUso } = await db
    .from(TABLA_CALIFICACIONES_KINDER_ES)
    .select('alumno_id')
    .eq('indicador_id', id)
    .neq('calificacion', '')
    .limit(1)
  if (errUso) throw new Error(errUso.message)
  if (usados?.length) throw new Error('Ya tiene calificaciones capturadas: desactívalo en lugar de borrarlo.')
  const { error } = await db.from(TABLA).delete().eq('grado', grado).eq('indicador_id', id)
  if (error) throw new Error(`Borrar campo: ${error.message}`)
}
