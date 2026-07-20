import type { AlumnoRegistro } from './alumnoDatosService'
import { calcularDestinoCambioCiclo } from './cambioCicloEscolarAdvance'
import { cicloInscripcionDesdeTemporada } from './ciclosEscolares'

export type ProyeccionReinscripcion = {
  cicloOrigen: number
  /** Ciclo al que aplica la reinscripción (costos, reglamentos, referencias). */
  cicloDestino: number
  nivel: number
  grado: number
  cambioNivel: boolean
  graduado: boolean
  /**
   * true = la ficha sigue en el ciclo anterior (ej. 22) y se proyecta al destino (23)
   * con promoción de grado/nivel.
   * false = ya corrió el cambio de ciclo (ficha en 23): no se vuelve a subir grado.
   */
  proyectaPromocion: boolean
  mensaje: string | null
}

/**
 * Destino de reinscripción según la ficha del alumno vs el cen de temporada
 * (`cicloInscripcionDesdeTemporada(es_actual)`).
 *
 * - Reinscrito aún en 22 → destino 23, costos/reglamento 23, grado/nivel proyectados.
 * - Tras cambio de ciclo (ficha ya en 23, es_actual 23) → destino 23, sin nueva promoción.
 */
export function proyectarReinscripcionAlumno(
  alumno: Pick<AlumnoRegistro, 'alumno_ciclo_escolar' | 'alumno_nivel' | 'alumno_grado'>,
  cicloTemporadaActual: number,
  ref?: Date
): ProyeccionReinscripcion {
  const cicloOrigen = Number(alumno.alumno_ciclo_escolar) || 0
  const nivelOrigen = Number(alumno.alumno_nivel) || 0
  const gradoOrigen = Number(alumno.alumno_grado) || 0
  const cenTemporada = cicloInscripcionDesdeTemporada(cicloTemporadaActual, ref)

  const proyectaPromocion = cicloOrigen > 0 && cicloOrigen < cenTemporada

  if (!proyectaPromocion) {
    const graduado = nivelOrigen === 4 && (gradoOrigen === 3 || gradoOrigen === 4)
    return {
      cicloOrigen,
      cicloDestino: cicloOrigen || cenTemporada,
      nivel: nivelOrigen,
      grado: gradoOrigen,
      cambioNivel: false,
      graduado,
      proyectaPromocion: false,
      mensaje: graduado
        ? '¡Felicidades! El alumno ha egresado del Instituto Winston Churchill.'
        : null,
    }
  }

  const dest = calcularDestinoCambioCiclo(nivelOrigen, gradoOrigen)
  const cicloDestino = cicloOrigen + 1
  const cambioNivel = dest.nivel !== nivelOrigen && !dest.egresa

  let mensaje: string | null = null
  if (dest.egresa) {
    mensaje =
      '¡Felicidades! El alumno ha egresado del Instituto Winston Churchill.'
  } else if (cambioNivel) {
    if (dest.nivel === 2) mensaje = 'Cambia de nivel a Kinder 1.'
    else if (dest.nivel === 3) mensaje = 'Cambia de nivel a Primaria.'
    else if (dest.nivel === 4) mensaje = 'Cambia de nivel a Secundaria.'
  }

  return {
    cicloOrigen,
    cicloDestino,
    nivel: dest.nivel,
    grado: dest.grado,
    cambioNivel,
    graduado: dest.egresa,
    proyectaPromocion: true,
    mensaje,
  }
}
