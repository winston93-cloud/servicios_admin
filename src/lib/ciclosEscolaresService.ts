import { supabase } from './supabase'
import { getCicloEscolarActual, proyectarCicloInscripcion } from './ciclosEscolares'

export interface CicloEscolarRegistro {
  id: number
  valor: number
  nombre: string
  anio_inicio: number
  anio_fin: number
  activo: boolean
  es_actual: boolean
}

export type CicloEscolarInput = {
  valor: number
  nombre: string
  anio_inicio: number
  anio_fin: number
  activo: boolean
  es_actual: boolean
}

const SELECT_CICLO =
  'id, valor, nombre, anio_inicio, anio_fin, activo, es_actual'

export async function listarCiclosEscolares(): Promise<CicloEscolarRegistro[]> {
  const { data, error } = await supabase
    .from('ciclos_escolares')
    .select(SELECT_CICLO)
    .order('valor', { ascending: true })

  if (error) {
    console.error('Error al listar ciclos escolares:', error)
    throw error
  }

  return (data ?? []) as CicloEscolarRegistro[]
}

export async function obtenerCicloEscolarActual(): Promise<CicloEscolarRegistro | null> {
  const { data, error } = await supabase
    .from('ciclos_escolares')
    .select(SELECT_CICLO)
    .eq('es_actual', true)
    .maybeSingle()

  if (error) {
    console.error('Error al obtener ciclo actual:', error)
    return null
  }

  return data as CicloEscolarRegistro | null
}

/**
 * Ciclo de temporada (`es_actual`). Si no hay fila en BD, fallback por fecha.
 * No hardcodear un valor numérico de ciclo.
 */
export async function resolverCicloEscolarSistemaValor(): Promise<number> {
  const actual = await obtenerCicloEscolarActual()
  if (actual?.valor != null && Number.isFinite(Number(actual.valor))) {
    return Number(actual.valor)
  }
  return getCicloEscolarActual()
}

/** Inscripción / próximo ciclo = origen + 1 (desde temporada actual). */
export async function resolverCicloInscripcionSistemaValor(): Promise<number> {
  const origen = await resolverCicloEscolarSistemaValor()
  return proyectarCicloInscripcion(origen)
}

export async function obtenerCicloPorValor(
  valor: number
): Promise<CicloEscolarRegistro | null> {
  const { data, error } = await supabase
    .from('ciclos_escolares')
    .select(SELECT_CICLO)
    .eq('valor', valor)
    .maybeSingle()

  if (error) {
    console.error('Error al obtener ciclo por valor:', error)
    return null
  }

  return data as CicloEscolarRegistro | null
}

export async function crearCicloEscolar(
  input: CicloEscolarInput
): Promise<CicloEscolarRegistro> {
  if (input.es_actual) {
    await quitarMarcaCicloActual()
  }

  const { data, error } = await supabase
    .from('ciclos_escolares')
    .insert(input)
    .select(SELECT_CICLO)
    .single()

  if (error) {
    console.error('Error al crear ciclo escolar:', error)
    throw error
  }

  return data as CicloEscolarRegistro
}

export async function actualizarCicloEscolar(
  id: number,
  input: Partial<CicloEscolarInput>
): Promise<CicloEscolarRegistro> {
  if (input.es_actual) {
    await quitarMarcaCicloActual(id)
  }

  const { data, error } = await supabase
    .from('ciclos_escolares')
    .update(input)
    .eq('id', id)
    .select(SELECT_CICLO)
    .single()

  if (error) {
    console.error('Error al actualizar ciclo escolar:', error)
    throw error
  }

  return data as CicloEscolarRegistro
}

export async function eliminarCicloEscolar(id: number): Promise<void> {
  const { error } = await supabase.from('ciclos_escolares').delete().eq('id', id)

  if (error) {
    console.error('Error al eliminar ciclo escolar:', error)
    throw error
  }
}

async function quitarMarcaCicloActual(exceptoId?: number): Promise<void> {
  let query = supabase.from('ciclos_escolares').update({ es_actual: false }).eq('es_actual', true)

  if (exceptoId != null) {
    query = query.neq('id', exceptoId)
  }

  const { error } = await query
  if (error) {
    console.error('Error al actualizar ciclo actual del sistema:', error)
    throw error
  }
}

export function opcionesDesdeCiclos(
  ciclos: CicloEscolarRegistro[]
): { valor: number; etiqueta: string }[] {
  return ciclos.map((c) => ({ valor: c.valor, etiqueta: c.nombre }))
}

/** Ciclos con `activo=true` para el selector de filtro (todos, no solo ≥ es_actual). */
export function ciclosParaSelector(
  ciclos: CicloEscolarRegistro[],
  _valorBase?: number
): CicloEscolarRegistro[] {
  const activos = ciclos.filter((c) => c.activo).sort((a, b) => a.valor - b.valor)
  if (activos.length > 0) return activos
  return [...ciclos].sort((a, b) => a.valor - b.valor)
}
