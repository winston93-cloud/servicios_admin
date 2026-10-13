import { createBoletasDb } from './boletasInsforge'
import type { BoletaModulo } from './boletasPortal'

export type BoletaEntregaEstado = 'captura' | 'enviada' | 'devuelta'

export type BoletaEntregaClave = {
  ciclo: number
  modulo: BoletaModulo
  trimestre: number
  grado: number
  grupo: string
}

export type BoletaEntrega = BoletaEntregaClave & {
  estado: BoletaEntregaEstado
  maestroId: number | null
  enviadaPor: string
  enviadaAt: string | null
  devueltaPor: string
  devueltaAt: string | null
  comentario: string
}

const TABLA = 'boleta_entrega'
const COLS =
  'ciclo, modulo, trimestre, grado, grupo, estado, maestro_id, enviada_por, enviada_at, devuelta_por, devuelta_at, comentario'

function mapEntrega(r: Record<string, unknown>): BoletaEntrega {
  return {
    ciclo: Number(r.ciclo),
    modulo: String(r.modulo) as BoletaModulo,
    trimestre: Number(r.trimestre),
    grado: Number(r.grado),
    grupo: String(r.grupo ?? ''),
    estado: r.estado === 'enviada' ? 'enviada' : 'devuelta',
    maestroId: r.maestro_id != null ? Number(r.maestro_id) : null,
    enviadaPor: String(r.enviada_por ?? ''),
    enviadaAt: r.enviada_at ? String(r.enviada_at) : null,
    devueltaPor: String(r.devuelta_por ?? ''),
    devueltaAt: r.devuelta_at ? String(r.devuelta_at) : null,
    comentario: String(r.comentario ?? ''),
  }
}

export function entregaVacia(clave: BoletaEntregaClave): BoletaEntrega {
  return {
    ...clave,
    estado: 'captura',
    maestroId: null,
    enviadaPor: '',
    enviadaAt: null,
    devueltaPor: '',
    devueltaAt: null,
    comentario: '',
  }
}

export async function obtenerEntrega(clave: BoletaEntregaClave): Promise<BoletaEntrega> {
  const { data, error } = await createBoletasDb()
    .from(TABLA)
    .select(COLS)
    .eq('ciclo', clave.ciclo)
    .eq('modulo', clave.modulo)
    .eq('trimestre', clave.trimestre)
    .eq('grado', clave.grado)
    .eq('grupo', clave.grupo)
    .limit(1)
  if (error) throw new Error(`Entrega de boletas: ${error.message}`)
  const row = data?.[0] as Record<string, unknown> | undefined
  return row ? mapEntrega(row) : entregaVacia(clave)
}

export async function listarEntregas(input: {
  ciclo: number
  modulo: BoletaModulo
  trimestre: number
}): Promise<BoletaEntrega[]> {
  const { data, error } = await createBoletasDb()
    .from(TABLA)
    .select(COLS)
    .eq('ciclo', input.ciclo)
    .eq('modulo', input.modulo)
    .eq('trimestre', input.trimestre)
  if (error) throw new Error(`Entregas de boletas: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map(mapEntrega)
}

export async function enviarEntrega(
  clave: BoletaEntregaClave,
  quien: { maestroId: number; nombre: string }
): Promise<BoletaEntrega> {
  const fila = {
    ...clave,
    estado: 'enviada',
    maestro_id: quien.maestroId,
    enviada_por: quien.nombre.slice(0, 120),
    enviada_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const { error } = await createBoletasDb()
    .from(TABLA)
    .upsert([fila], { onConflict: 'ciclo,modulo,trimestre,grado,grupo' })
  if (error) throw new Error(`Enviar a dirección: ${error.message}`)
  return obtenerEntrega(clave)
}

export async function devolverEntrega(
  clave: BoletaEntregaClave,
  quien: { nombre: string; comentario: string }
): Promise<BoletaEntrega> {
  const actual = await obtenerEntrega(clave)
  if (actual.estado !== 'enviada') throw new Error('Ese grupo no está enviado a dirección.')
  const { error } = await createBoletasDb()
    .from(TABLA)
    .update({
      estado: 'devuelta',
      devuelta_por: quien.nombre.slice(0, 120),
      devuelta_at: new Date().toISOString(),
      comentario: quien.comentario.trim().slice(0, 500) || null,
      updated_at: new Date().toISOString(),
    })
    .eq('ciclo', clave.ciclo)
    .eq('modulo', clave.modulo)
    .eq('trimestre', clave.trimestre)
    .eq('grado', clave.grado)
    .eq('grupo', clave.grupo)
  if (error) throw new Error(`Regresar a la teacher: ${error.message}`)
  return obtenerEntrega(clave)
}
