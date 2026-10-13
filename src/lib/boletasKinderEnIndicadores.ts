import { createBoletasDb } from './boletasInsforge'
import {
  esGradoKinderEn,
  type KinderEnFormato,
  type KinderEnGrado,
  type KinderEnIndicador,
  type KinderEnTipo,
} from './boletasKinderEnCatalog'

const TABLA = 'boleta_kinder_en_indicador'

const TABLA_CALIFS: Record<KinderEnTipo, string> = {
  subject: 'boleta_calificacion_kinder_en',
  behavioral: 'boleta_behavioral_kinder_en',
  maternal: 'boleta_calificacion_maternal_en',
}

export function tablaCalificacionesKinderEn(tipo: KinderEnTipo): string {
  return TABLA_CALIFS[tipo]
}

export function esTipoKinderEn(v: unknown): v is KinderEnTipo {
  return v === 'subject' || v === 'behavioral' || v === 'maternal'
}

function mapRow(r: Record<string, unknown>): KinderEnIndicador {
  return {
    id: Number(r.indicador_id),
    tipo: String(r.tipo) as KinderEnTipo,
    grado: Number(r.grado) as KinderEnGrado,
    nombre: String(r.nombre ?? ''),
    orden: Number(r.orden ?? 0),
    formato: r.formato === 'numero' ? 'numero' : 'escala',
    enPromedio: Boolean(r.en_promedio),
    activo: Boolean(r.activo),
  }
}

const COLS = 'tipo, grado, indicador_id, nombre, orden, formato, en_promedio, activo'

export async function listarIndicadoresKinderEn(opts: { tipo?: KinderEnTipo } = {}): Promise<KinderEnIndicador[]> {
  let q = createBoletasDb().from(TABLA).select(COLS)
  if (opts.tipo) q = q.eq('tipo', opts.tipo)
  const { data, error } = await q
    .order('tipo')
    .order('grado')
    .order('orden')
    .order('indicador_id')
  if (error) throw new Error(`Catálogo Kinder Inglés: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow)
}

/** Indicadores activos que se capturan para un grado (maternal = grado 0). */
export async function indicadoresActivosKinderEn(
  tipo: KinderEnTipo,
  grado: KinderEnGrado
): Promise<KinderEnIndicador[]> {
  if ((tipo === 'maternal') !== (grado === 0)) return []
  const { data, error } = await createBoletasDb()
    .from(TABLA)
    .select(COLS)
    .eq('tipo', tipo)
    .eq('grado', grado)
    .eq('activo', true)
    .order('orden')
    .order('indicador_id')
  if (error) throw new Error(`Catálogo Kinder Inglés: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow)
}

function validarTipoGrado(tipo: unknown, grado: unknown): { tipo: KinderEnTipo; grado: KinderEnGrado } {
  if (!esTipoKinderEn(tipo)) throw new Error('Tipo de indicador inválido.')
  const g = Number(grado)
  if (!esGradoKinderEn(g)) throw new Error('Grado inválido.')
  if ((tipo === 'maternal') !== (g === 0)) {
    throw new Error(tipo === 'maternal' ? 'Maternal usa grado 0.' : 'Subjects y Behavioral son de K1 a K3.')
  }
  return { tipo, grado: g }
}

async function siguienteId(tipo: KinderEnTipo): Promise<number> {
  const { data, error } = await createBoletasDb()
    .from(TABLA)
    .select('indicador_id')
    .eq('tipo', tipo)
    .order('indicador_id', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  const max = Number((data?.[0] as Record<string, unknown> | undefined)?.indicador_id ?? 0)
  return Math.max(max, tipo === 'behavioral' ? 100 : 0) + 1
}

async function siguienteOrden(tipo: KinderEnTipo, grado: KinderEnGrado): Promise<number> {
  const { data } = await createBoletasDb()
    .from(TABLA)
    .select('orden')
    .eq('tipo', tipo)
    .eq('grado', grado)
    .order('orden', { ascending: false })
    .limit(1)
  return Number((data?.[0] as Record<string, unknown> | undefined)?.orden ?? 0) + 1
}

export async function guardarIndicadorKinderEn(input: {
  tipo: unknown
  grado: unknown
  id?: unknown
  nombre: unknown
  orden?: unknown
  formato?: unknown
  enPromedio?: unknown
  activo?: unknown
}): Promise<KinderEnIndicador> {
  const { tipo, grado } = validarTipoGrado(input.tipo, input.grado)
  const nombre = String(input.nombre ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
  if (!nombre) throw new Error('Escribe el nombre.')
  if (nombre.length > 120) throw new Error('El nombre es muy largo (máximo 120).')
  const formato: KinderEnFormato = tipo === 'maternal' && input.formato === 'numero' ? 'numero' : 'escala'
  const idPrevio = Number(input.id)
  const esNuevo = !(Number.isInteger(idPrevio) && idPrevio > 0)

  const db = createBoletasDb()
  if (!esNuevo) {
    const { data } = await db
      .from(TABLA)
      .select('indicador_id')
      .eq('tipo', tipo)
      .eq('grado', grado)
      .eq('indicador_id', idPrevio)
      .limit(1)
    if (!data?.length) throw new Error('Ese indicador ya no existe; recarga la página.')
  }

  const ordenRaw = Number(input.orden)
  const fila = {
    tipo,
    grado,
    indicador_id: esNuevo ? await siguienteId(tipo) : idPrevio,
    nombre,
    orden: Number.isInteger(ordenRaw) && ordenRaw > 0 ? Math.min(ordenRaw, 999) : await siguienteOrden(tipo, grado),
    formato,
    en_promedio: tipo === 'subject' ? input.enPromedio !== false : false,
    activo: input.activo !== false,
    updated_at: new Date().toISOString(),
  }
  const { error } = await db.from(TABLA).upsert([fila], { onConflict: 'tipo,grado,indicador_id' })
  if (error) throw new Error(`Guardar indicador: ${error.message}`)
  return mapRow(fila)
}

/** Borra solo si nadie lo ha calificado; si ya tiene calificaciones, hay que desactivarlo. */
export async function eliminarIndicadorKinderEn(input: { tipo: unknown; grado: unknown; id: unknown }): Promise<void> {
  const { tipo, grado } = validarTipoGrado(input.tipo, input.grado)
  const id = Number(input.id)
  if (!Number.isInteger(id) || id <= 0) throw new Error('Indicador inválido.')
  const db = createBoletasDb()
  const { data: usados, error: errUso } = await db
    .from(TABLA_CALIFS[tipo])
    .select('alumno_id')
    .eq('indicador_id', id)
    .neq('calificacion', '')
    .limit(1)
  if (errUso) throw new Error(errUso.message)
  if (usados?.length) {
    throw new Error('Ya tiene calificaciones capturadas: desactívalo en lugar de borrarlo.')
  }
  const { error } = await db
    .from(TABLA)
    .delete()
    .eq('tipo', tipo)
    .eq('grado', grado)
    .eq('indicador_id', id)
  if (error) throw new Error(`Borrar indicador: ${error.message}`)
}
