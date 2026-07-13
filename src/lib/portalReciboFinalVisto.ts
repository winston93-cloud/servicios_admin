import type { EstadoPortalInscripciones, PasoInscripcion } from './portalInscripcionesTypes'

const PREFIX = 'portal_inscripciones_recibo_final_visto'

export function claveReciboFinalVisto(alumnoId: number, cicloValor: number): string {
  return `${PREFIX}_${alumnoId}_${cicloValor}`
}

export function leerReciboFinalVisto(alumnoId: number, cicloValor: number): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(claveReciboFinalVisto(alumnoId, cicloValor)) === '1'
  } catch {
    return false
  }
}

export function marcarReciboFinalVisto(alumnoId: number, cicloValor: number): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(claveReciboFinalVisto(alumnoId, cicloValor), '1')
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
 * Con 1 visita al recibo final, el paso pasa a completado
 * y se desbloquean las colegiaturas (NI). El enlace sigue disponible.
 */
export function aplicarReciboFinalVistoEnEstado(
  estado: EstadoPortalInscripciones,
  visto: boolean
): EstadoPortalInscripciones {
  if (!visto) return estado

  const pasos = estado.pasos.map((paso) => {
    if (paso.id !== 'recibo-final') return paso
    if (paso.estado === 'bloqueado') return paso
    return {
      ...paso,
      estado: 'completado' as const,
      detalle:
        'Ya generaste el recibo final. Puedes volver a abrirlo cuando lo necesites. Las colegiaturas del ciclo ya están desbloqueadas.',
      accion: paso.accion
        ? {
            ...paso.accion,
            etiqueta: 'Ver recibo final',
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
