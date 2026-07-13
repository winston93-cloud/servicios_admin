import type { EstadoPortalInscripciones, PasoInscripcion } from './portalInscripcionesTypes'

const PREFIX = 'portal_inscripciones_reglamento_visto'

export function claveReglamentoVisto(alumnoId: number, cicloValor: number): string {
  return `${PREFIX}_${alumnoId}_${cicloValor}`
}

export function leerReglamentoVisto(alumnoId: number, cicloValor: number): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(claveReglamentoVisto(alumnoId, cicloValor)) === '1'
  } catch {
    return false
  }
}

export function marcarReglamentoVisto(alumnoId: number, cicloValor: number): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(claveReglamentoVisto(alumnoId, cicloValor), '1')
  } catch {
    /* ignore quota / private mode */
  }
}

function recalcularProgreso(pasos: PasoInscripcion[]): {
  pasosCompletados: number
  pasosTotales: number
  progresoPct: number
} {
  const pasosTotales = pasos.length
  const pasosCompletados = pasos.filter((p) => p.estado === 'completado').length
  return {
    pasosCompletados,
    pasosTotales,
    progresoPct:
      pasosTotales > 0 ? Math.round((pasosCompletados / pasosTotales) * 100) : 0,
  }
}

/**
 * Si el papá ya abrió el reglamento una vez, el paso pasa a completado
 * pero conserva la acción para volver a descargarlo.
 */
export function aplicarReglamentoVistoEnEstado(
  estado: EstadoPortalInscripciones,
  visto: boolean
): EstadoPortalInscripciones {
  if (!visto) return estado

  const pasos = estado.pasos.map((paso) => {
    if (paso.id !== 'reglamento') return paso
    if (paso.estado === 'bloqueado') return paso
    return {
      ...paso,
      estado: 'completado' as const,
      detalle:
        'Ya consultaste el reglamento. Puedes volver a descargarlo cuando lo necesites.',
      accion: paso.accion
        ? {
            ...paso.accion,
            etiqueta: 'Ver reglamento y carta compromiso',
          }
        : paso.accion,
    }
  })

  return {
    ...estado,
    pasos,
    ...recalcularProgreso(pasos),
  }
}
