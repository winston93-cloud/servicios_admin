import type { PagoDetalleRegistro } from './pagoColegiaturaService'
import { alumnoTienePagoSemiref } from './portalAdmisionesColegiatura'

export type BloqueoManualPortalInscripcion = {
  alumno_id: number
  mensaje?: string
}

export const MENSAJE_BLOQUEO_COORDINACION_SECUNDARIA =
  'Cualquier duda comuníquese a Coordinación Secundaria.'

/**
 * Lista operativa del portal de inscripciones.
 * El bloqueo aplica cuando el alumno liquida julio (concepto 26) del ciclo a cerrar.
 */
export const BLOQUEOS_MANUALES_PORTAL_INSCRIPCION: BloqueoManualPortalInscripcion[] = [
  {
    alumno_id: 1740, // 21145 · DOMINIQUE MACKENZYE GRANIEL PADILLA
    mensaje: MENSAJE_BLOQUEO_COORDINACION_SECUNDARIA,
  },
]

const CONCEPTO_JULIO = '26'

/**
 * Tras pagar julio del ciclo anterior, devuelve el mensaje de bloqueo o null.
 */
export function evaluarBloqueoManualPortalReinscripcion(
  alumnoId: number,
  alumnoRef: string | number,
  pagosCierre: PagoDetalleRegistro[] | undefined,
  cicloCierreValor: number | undefined
): string | null {
  const id = Number(alumnoId)
  if (!Number.isFinite(id) || id <= 0) return null
  if (!pagosCierre?.length || cicloCierreValor == null) return null

  const hit = BLOQUEOS_MANUALES_PORTAL_INSCRIPCION.find((b) => b.alumno_id === id)
  if (!hit) return null

  const julioPagado = alumnoTienePagoSemiref(
    pagosCierre,
    alumnoRef,
    CONCEPTO_JULIO,
    cicloCierreValor
  )
  if (!julioPagado) return null

  return hit.mensaje?.trim() || MENSAJE_BLOQUEO_COORDINACION_SECUNDARIA
}
