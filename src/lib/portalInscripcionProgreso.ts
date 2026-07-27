import type { AppDatabaseClient } from '@/lib/dbTypes'

export type PortalInscripcionProgreso = {
  alumno_id: number
  ciclo_valor: number
  reglamento_visto: boolean
  recibo_final_visto: boolean
  plan_confirmado: boolean
}

export async function obtenerPortalInscripcionProgreso(
  db: AppDatabaseClient,
  alumnoId: number,
  cicloValor: number
): Promise<PortalInscripcionProgreso | null> {
  const { data, error } = await db
    .from('portal_inscripcion_progreso')
    .select(
      'alumno_id, ciclo_valor, reglamento_visto, recibo_final_visto, plan_confirmado'
    )
    .eq('alumno_id', alumnoId)
    .eq('ciclo_valor', cicloValor)
    .maybeSingle()

  if (error) {
    console.warn('obtenerPortalInscripcionProgreso:', error.message)
    return null
  }
  if (!data) return null
  return {
    alumno_id: Number(data.alumno_id),
    ciclo_valor: Number(data.ciclo_valor),
    reglamento_visto: Boolean(data.reglamento_visto),
    recibo_final_visto: Boolean(data.recibo_final_visto),
    plan_confirmado: Boolean(data.plan_confirmado),
  }
}

export type MarcaPortalProgreso = {
  reglamento_visto?: boolean
  recibo_final_visto?: boolean
  plan_confirmado?: boolean
}

/** Upsert parcial: solo enciende flags (no apaga los que ya estaban true). */
export async function marcarPortalInscripcionProgreso(
  db: AppDatabaseClient,
  alumnoId: number,
  cicloValor: number,
  marca: MarcaPortalProgreso
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actual = await obtenerPortalInscripcionProgreso(db, alumnoId, cicloValor)
  const fila = {
    alumno_id: alumnoId,
    ciclo_valor: cicloValor,
    reglamento_visto: Boolean(actual?.reglamento_visto || marca.reglamento_visto),
    recibo_final_visto: Boolean(
      actual?.recibo_final_visto || marca.recibo_final_visto
    ),
    plan_confirmado: Boolean(actual?.plan_confirmado || marca.plan_confirmado),
    actualizado_en: new Date().toISOString(),
  }

  const { error } = await db
    .from('portal_inscripcion_progreso')
    .upsert(fila, { onConflict: 'alumno_id,ciclo_valor' })

  if (error) {
    console.error('marcarPortalInscripcionProgreso:', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
