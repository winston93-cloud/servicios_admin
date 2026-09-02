/**
 * Bloqueos manuales para entrada al colegio (revisión pagados).
 * Anulan el verde aunque el alumno tenga 12/13 pagados.
 */

export type BloqueoEntradaAlumno = {
  alumno_id: number
  /** Opcional; si falta, se usa el mensaje por defecto. */
  mensaje?: string
}

export const MENSAJE_BLOQUEO_ENTRADA_DEFAULT =
  'Cualquier duda comuníquese a Coordinación Secundaria.'

/**
 * Lista operativa (agregar alumno_id + mensaje opcional).
 * Ej.: alumna con pago julio ciclo anterior pero sin autorización de entrada.
 */
export const BLOQUEOS_ENTRADA_ALUMNOS: BloqueoEntradaAlumno[] = [
  {
    alumno_id: 1740, // 21145 · DOMINIQUE MACKENZYE GRANIEL PADILLA
    mensaje: MENSAJE_BLOQUEO_ENTRADA_DEFAULT,
  },
]

export function bloqueoEntradaParaAlumno(alumnoId: number): {
  bloqueado: boolean
  mensaje: string | null
} {
  const id = Number(alumnoId)
  if (!Number.isFinite(id) || id <= 0) {
    return { bloqueado: false, mensaje: null }
  }
  const hit = BLOQUEOS_ENTRADA_ALUMNOS.find((b) => b.alumno_id === id)
  if (!hit) return { bloqueado: false, mensaje: null }
  return {
    bloqueado: true,
    mensaje: hit.mensaje?.trim() || MENSAJE_BLOQUEO_ENTRADA_DEFAULT,
  }
}

/** Verde/rojo efectivo para entrada (bloqueo manda sobre pagos). */
export function entradaPermitida(
  pagadoInscripcion: boolean,
  alumnoId: number
): { permitido: boolean; bloqueado: boolean; mensaje: string | null } {
  const bloqueo = bloqueoEntradaParaAlumno(alumnoId)
  if (bloqueo.bloqueado) {
    return {
      permitido: false,
      bloqueado: true,
      mensaje: bloqueo.mensaje,
    }
  }
  return {
    permitido: pagadoInscripcion,
    bloqueado: false,
    mensaje: null,
  }
}
