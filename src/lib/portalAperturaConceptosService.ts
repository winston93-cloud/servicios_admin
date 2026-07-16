import type { AppDatabaseClient } from '@/lib/dbTypes'

export type PortalAperturaConceptos = {
  cambridge_abierto: boolean
  doble_titulacion_abierto: boolean
  actualizado_en: string | null
  actualizado_por: string | null
}

const CERRADO: PortalAperturaConceptos = {
  cambridge_abierto: false,
  doble_titulacion_abierto: false,
  actualizado_en: null,
  actualizado_por: null,
}

export async function obtenerAperturaConceptosPortal(
  db: AppDatabaseClient
): Promise<PortalAperturaConceptos> {
  const { data, error } = await db
    .from('portal_apertura_conceptos')
    .select('cambridge_abierto,doble_titulacion_abierto,actualizado_en,actualizado_por')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    // Tabla aún no migrada → cerrado (seguro).
    if (/does not exist|relation .* does not exist/i.test(error.message)) {
      return { ...CERRADO }
    }
    throw new Error(error.message)
  }
  if (!data) return { ...CERRADO }

  return {
    cambridge_abierto: Boolean(data.cambridge_abierto),
    doble_titulacion_abierto: Boolean(data.doble_titulacion_abierto),
    actualizado_en: data.actualizado_en ? String(data.actualizado_en) : null,
    actualizado_por: data.actualizado_por ? String(data.actualizado_por) : null,
  }
}

export async function guardarAperturaConceptosPortal(
  db: AppDatabaseClient,
  input: {
    cambridge_abierto: boolean
    doble_titulacion_abierto: boolean
    actualizado_por?: string | null
  }
): Promise<PortalAperturaConceptos> {
  const fila = {
    id: 1,
    cambridge_abierto: Boolean(input.cambridge_abierto),
    doble_titulacion_abierto: Boolean(input.doble_titulacion_abierto),
    actualizado_en: new Date().toISOString(),
    actualizado_por: input.actualizado_por?.trim() || null,
  }

  const { data, error } = await db
    .from('portal_apertura_conceptos')
    .upsert(fila, { onConflict: 'id' })
    .select('cambridge_abierto,doble_titulacion_abierto,actualizado_en,actualizado_por')
    .maybeSingle()

  if (error) {
    if (/does not exist|relation .* does not exist/i.test(error.message)) {
      throw new Error(
        'Falta la tabla portal_apertura_conceptos en InsForge. Ejecuta: node scripts/apply-insforge-sql.mjs migrations/20260716150000_portal_apertura_conceptos.sql'
      )
    }
    throw new Error(error.message)
  }

  return {
    cambridge_abierto: Boolean(data?.cambridge_abierto),
    doble_titulacion_abierto: Boolean(data?.doble_titulacion_abierto),
    actualizado_en: data?.actualizado_en ? String(data.actualizado_en) : fila.actualizado_en,
    actualizado_por: data?.actualizado_por ? String(data.actualizado_por) : fila.actualizado_por,
  }
}
