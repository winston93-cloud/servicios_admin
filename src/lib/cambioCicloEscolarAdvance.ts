import type { NivelEscolarValor } from './nivelEscolar'
import { etiquetaNivelEscolar } from './nivelEscolar'
import { etiquetaGradoEscolar } from './gradoEscolar'

/** Ciclo 2025-2026 que termina. */
export const CICLO_CAMBIO_ORIGEN = 22

/** Ciclo 2026-2027 que inicia (~20 jul). */
export const CICLO_CAMBIO_DESTINO = 23

const MAX_GRADO_POR_NIVEL: Record<NivelEscolarValor, number> = {
  1: 2,
  2: 3,
  3: 6,
  4: 3,
}

export interface DestinoCambioCiclo {
  nivel: number
  grado: number
  /** Secundaria 9no (grado 3): pasa a Egresados (grado 4) con baja general. */
  egresa: boolean
}

/** Etiqueta legible del destino (incluye Egresados en secundaria grado 4). */
export function etiquetaDestinoCambioCiclo(dest: DestinoCambioCiclo): string {
  if (dest.egresa || (dest.nivel === 4 && dest.grado === 4)) {
    return 'Egresados'
  }
  return `${etiquetaNivelEscolar(dest.nivel)} · ${etiquetaGradoEscolar(dest.nivel, dest.grado)}`
}

/**
 * Avance al pasar del ciclo origen al destino (valores en BD):
 *
 * - Maternal (nivel 1): grado 1 = A, 2 = B → dentro del nivel +1; B (2) → Kinder-1 (nivel 2, grado 1)
 * - Kinder Educativo (nivel 2): grados 1–3 → dentro +1; K-3 (3) → 1° Primaria (nivel 3, grado 1)
 * - Primaria Winston (nivel 3): grados 1–6 → dentro +1; 6° (6) → 7mo (nivel 4, grado 1)
 * - Secundaria (nivel 4): grados 1–3 (7mo–9no) → dentro +1; 9no (3) → Egresados (grado 4, baja general)
 */
export function calcularDestinoCambioCiclo(
  nivelOrigen: number,
  gradoOrigen: number
): DestinoCambioCiclo {
  const nivel = nivelOrigen as NivelEscolarValor
  const max = MAX_GRADO_POR_NIVEL[nivel]

  if (nivel === 4 && gradoOrigen === 3) {
    return { nivel: 4, grado: 4, egresa: true }
  }

  if (gradoOrigen < max) {
    return { nivel: nivelOrigen, grado: gradoOrigen + 1, egresa: false }
  }

  if (nivel === 1 && gradoOrigen === 2) {
    return { nivel: 2, grado: 1, egresa: false }
  }
  if (nivel === 2 && gradoOrigen === 3) {
    return { nivel: 3, grado: 1, egresa: false }
  }
  if (nivel === 3 && gradoOrigen === 6) {
    return { nivel: 4, grado: 1, egresa: false }
  }

  return { nivel: nivelOrigen, grado: gradoOrigen + 1, egresa: false }
}
