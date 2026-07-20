import type { AppDatabaseClient } from '@/lib/dbTypes'
import { puedeAccederPortalAlumno } from '@/lib/alumnoStatus'

const CLAVE_MIN_LENGTH = 5

export type ResultadoRegistrarClave =
  | { ok: true; mensaje: string }
  | { ok: false; mensaje: string; codigo?: number }

async function obtenerAlumnoActivoPorRef(
  db: AppDatabaseClient,
  alumnoRef: number
) {
  const { data, error } = await db
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_status, alumno_ciclo_escolar')
    .eq('alumno_ref', alumnoRef)
    .order('alumno_ciclo_escolar', { ascending: false })
    .limit(5)

  if (error) throw new Error(error.message)
  const fila = (data ?? []).find((r) =>
    puedeAccederPortalAlumno(Number(r.alumno_status))
  )
  return fila ?? null
}

/** `detalle_id` no siempre usa DEFAULT; si la secuencia va atrasada, hay que asignar max+1. */
async function siguienteDetalleId(db: AppDatabaseClient): Promise<number> {
  const { data, error } = await db
    .from('alumno_detalles')
    .select('detalle_id')
    .order('detalle_id', { ascending: false })
    .limit(1)

  if (error) throw new Error(error.message)
  const max = data?.[0]?.detalle_id != null ? Number(data[0].detalle_id) : 0
  return max + 1
}

/**
 * Activa la clave del alumno en `alumno_detalles.alumno_clave` (legacy admisiones).
 * Solo si aún no tiene clave de al menos 5 caracteres.
 */
export async function registrarClaveAlumnoPortal(
  db: AppDatabaseClient,
  alumnoRefInput: string,
  claveNueva: string,
  claveConfirmacion: string
): Promise<ResultadoRegistrarClave> {
  const ref = parseInt(String(alumnoRefInput).replace(/\D/g, ''), 10)
  if (!Number.isFinite(ref) || ref <= 0 || String(ref).length !== 5) {
    return { ok: false, mensaje: 'Ingresa un número de control válido (5 dígitos).' }
  }

  const clave = claveNueva.trim()
  const confirmacion = claveConfirmacion.trim()

  if (clave.length < CLAVE_MIN_LENGTH) {
    return {
      ok: false,
      mensaje: 'Tu clave debe contener al menos 5 caracteres.',
      codigo: 406,
    }
  }

  if (clave !== confirmacion) {
    return {
      ok: false,
      mensaje: 'Las claves no coinciden. Registra de nuevo tu clave.',
      codigo: 407,
    }
  }

  const alumno = await obtenerAlumnoActivoPorRef(db, ref)
  if (!alumno) {
    return {
      ok: false,
      mensaje:
        'No encontramos un alumno con acceso al portal para ese número de control.',
    }
  }

  const { data: detalle, error: errDetalle } = await db
    .from('alumno_detalles')
    .select('detalle_id, alumno_clave')
    .eq('alumno_id', alumno.alumno_id)
    .order('detalle_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (errDetalle) throw new Error(errDetalle.message)

  const claveActual = (detalle?.alumno_clave ?? '').trim()
  if (claveActual.length >= CLAVE_MIN_LENGTH) {
    return {
      ok: false,
      mensaje: 'Tu clave ya fue activada anteriormente.',
      codigo: 405,
    }
  }

  if (detalle?.detalle_id) {
    const { error: errUpdate } = await db
      .from('alumno_detalles')
      .update({ alumno_clave: clave })
      .eq('detalle_id', detalle.detalle_id)

    if (errUpdate) throw new Error(errUpdate.message)
  } else {
    const detalleId = await siguienteDetalleId(db)
    const { error: errInsert } = await db.from('alumno_detalles').insert({
      detalle_id: detalleId,
      alumno_id: alumno.alumno_id,
      alumno_clave: clave,
    })

    if (errInsert) throw new Error(errInsert.message)
  }

  return { ok: true, mensaje: 'Tu clave ha sido activada con éxito. Ya puedes entrar al sistema.' }
}
