import { createBoletasDb } from './boletasInsforge'
import type { BoletaModulo } from './boletasPortal'

/** Trimestre abierto a captura de maestros (0 = cerrada). Sin fila = cerrada. */
export type CapturaPeriodo = { trimestre: number; actualizadoPor: string; actualizadoAt: string | null }

const TABLA = 'boleta_captura_periodo'

export async function obtenerCapturaPeriodo(ciclo: number, modulo: BoletaModulo): Promise<CapturaPeriodo> {
  const { data, error } = await createBoletasDb()
    .from(TABLA)
    .select('trimestre, actualizado_por, updated_at')
    .eq('ciclo', ciclo)
    .eq('modulo', modulo)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const r = (data ?? null) as Record<string, unknown> | null
  return {
    trimestre: Number(r?.trimestre ?? 0),
    actualizadoPor: String(r?.actualizado_por ?? ''),
    actualizadoAt: r?.updated_at ? String(r.updated_at) : null,
  }
}

export async function fijarCapturaPeriodo(input: {
  ciclo: number
  modulo: BoletaModulo
  trimestre: number
  por: string
}): Promise<CapturaPeriodo> {
  if (!Number.isInteger(input.trimestre) || input.trimestre < 0 || input.trimestre > 3) {
    throw new Error('Trimestre inválido (0 = cerrada, 1 a 3).')
  }
  const { error } = await createBoletasDb()
    .from(TABLA)
    .upsert(
      [{ ciclo: input.ciclo, modulo: input.modulo, trimestre: input.trimestre, actualizado_por: input.por, updated_at: new Date().toISOString() }],
      { onConflict: 'ciclo,modulo' }
    )
  if (error) throw new Error(error.message)
  return obtenerCapturaPeriodo(input.ciclo, input.modulo)
}
