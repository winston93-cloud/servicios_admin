/**
 * Al enviar la carta firmada: activa alumno_beca en el ciclo de cobro actual (23→24…)
 * para que el portal aplique el % solo en colegiaturas (no cuota 00 ni otros conceptos).
 */
import type { AppDatabaseClient } from '@/lib/dbTypes'
import { BECA_ESTATUS_ACTIVA } from '@/lib/becaEstatus'
import { cicloFirmaBecaActual } from './cicloFirmaBeca'
import { resolverBecaRenovacionAlumno } from './resolverBecaRenovacionAlumno'
import type { AutorizacionFirmaRow } from './autorizacionFirmaService'

export type BecaCobroActivada = {
  ciclo_escolar: number
  beca_id: number
  beca_porcentaje: number
  alumno_beca_id: number
}

async function resolverTipoPorcentajeBeca(
  db: AppDatabaseClient,
  auth: AutorizacionFirmaRow
): Promise<{ beca_id: number; beca_porcentaje: number } | null> {
  if (auth.flujo === 'solicitud') {
    const { data, error } = await db
      .from('becas_solicitud')
      .select('beca_deseada_id, beca_porcentaje_deseado')
      .eq('id', auth.expediente_id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const beca_id = Number(data?.beca_deseada_id ?? 0)
    const beca_porcentaje = Number(data?.beca_porcentaje_deseado ?? NaN)
    if (!(beca_id > 0) || !Number.isFinite(beca_porcentaje)) return null
    return {
      beca_id,
      beca_porcentaje: Math.max(0, Math.min(100, Math.round(beca_porcentaje))),
    }
  }

  const becaRow = await resolverBecaRenovacionAlumno(db, auth.alumno_id)
  const beca_id = Number(becaRow.beca_id ?? 0)
  const beca_porcentaje = Number(becaRow.beca_porcentaje ?? NaN)
  if (!(beca_id > 0) || !Number.isFinite(beca_porcentaje)) return null
  return {
    beca_id,
    beca_porcentaje: Math.max(0, Math.min(100, Math.round(beca_porcentaje))),
  }
}

/** Upsert alumno_beca activa en el ciclo de cobro (ej. 23) tras firma de carta. */
export async function activarAlumnoBecaCobroCicloActual(
  db: AppDatabaseClient,
  auth: AutorizacionFirmaRow
): Promise<
  | { ok: true; data: BecaCobroActivada }
  | { ok: false; error: string; status?: number }
> {
  const beca = await resolverTipoPorcentajeBeca(db, auth)
  if (!beca) {
    return {
      ok: false,
      error:
        'No se encontró tipo y porcentaje de beca para activar el descuento en colegiaturas.',
      status: 400,
    }
  }

  const cicloCobro = Number(auth.ciclo_escolar)
  const ahora = new Date().toISOString()

  const { data: alumno, error: alErr } = await db
    .from('alumno')
    .select('alumno_ref')
    .eq('alumno_id', auth.alumno_id)
    .maybeSingle()
  if (alErr) return { ok: false, error: alErr.message, status: 500 }

  const fila = {
    beca_id: beca.beca_id,
    beca_porcentaje: beca.beca_porcentaje,
    beca_estatus: BECA_ESTATUS_ACTIVA,
    beca_ciclo_escolar: cicloCobro,
    beca_p: '0',
    beca_actualizacion: ahora,
    ...(alumno?.alumno_ref != null
      ? { alumno_ref: Number(alumno.alumno_ref) }
      : {}),
  }

  const { data: existente, error: exErr } = await db
    .from('alumno_beca')
    .select('alumno_beca_id')
    .eq('alumno_id', auth.alumno_id)
    .maybeSingle()
  if (exErr) return { ok: false, error: exErr.message, status: 500 }

  if (existente?.alumno_beca_id) {
    const { data, error } = await db
      .from('alumno_beca')
      .update(fila)
      .eq('alumno_beca_id', existente.alumno_beca_id)
      .eq('alumno_id', auth.alumno_id)
      .select('alumno_beca_id')
      .maybeSingle()
    if (error) return { ok: false, error: error.message, status: 500 }
    if (!data?.alumno_beca_id) {
      return { ok: false, error: 'No se pudo actualizar alumno_beca.', status: 500 }
    }
    return {
      ok: true,
      data: {
        ciclo_escolar: cicloCobro,
        beca_id: beca.beca_id,
        beca_porcentaje: beca.beca_porcentaje,
        alumno_beca_id: Number(data.alumno_beca_id),
      },
    }
  }

  const { data, error } = await db
    .from('alumno_beca')
    .insert({
      alumno_id: auth.alumno_id,
      ...fila,
      beca_registro: ahora,
    })
    .select('alumno_beca_id')
    .maybeSingle()
  if (error) return { ok: false, error: error.message, status: 500 }
  if (!data?.alumno_beca_id) {
    return { ok: false, error: 'No se pudo crear alumno_beca.', status: 500 }
  }

  return {
    ok: true,
    data: {
      ciclo_escolar: cicloCobro,
      beca_id: beca.beca_id,
      beca_porcentaje: beca.beca_porcentaje,
      alumno_beca_id: Number(data.alumno_beca_id),
    },
  }
}

/**
 * Si ya firmó carta pero alumno_beca no quedó en el ciclo de cobro (p. ej. unique alumno_id),
 * re-sincroniza antes de calcular importes. Aplica a cualquier alumno, no caso por caso.
 */
export async function sincronizarAlumnoBecaCobroTrasFirma(
  db: AppDatabaseClient,
  alumnoId: number,
  cicloEscolar: number
): Promise<void> {
  const { data: auth, error: authErr } = await db
    .from('becas_autorizacion_firma')
    .select(
      'id, alumno_id, ciclo_escolar, flujo, expediente_id, activo, beca_activada, beca_activada_en, firmado_por, carta_firmada_bucket, carta_firmada_key, carta_firmada_url'
    )
    .eq('alumno_id', alumnoId)
    .eq('ciclo_escolar', cicloEscolar)
    .eq('activo', true)
    .eq('beca_activada', true)
    .maybeSingle()
  if (authErr || !auth) return

  const { data: ab, error: abErr } = await db
    .from('alumno_beca')
    .select('beca_ciclo_escolar, beca_estatus')
    .eq('alumno_id', alumnoId)
    .maybeSingle()
  if (abErr) return

  const ok =
    Number(ab?.beca_ciclo_escolar) === cicloEscolar &&
    Number(ab?.beca_estatus) === BECA_ESTATUS_ACTIVA
  if (ok) return

  await activarAlumnoBecaCobroCicloActual(db, auth as AutorizacionFirmaRow)
}
