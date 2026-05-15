import type { NivelEscolarValor } from './nivelEscolar'
import { parseNivelEscolar } from './nivelEscolar'

export interface GradoEscolarOpcion {
  valor: number
  etiqueta: string
}

const GRADOS_POR_NIVEL: Record<NivelEscolarValor, GradoEscolarOpcion[]> = {
  1: [
    { valor: 1, etiqueta: 'Maternal A' },
    { valor: 2, etiqueta: 'Maternal B' },
  ],
  2: [
    { valor: 1, etiqueta: 'Kinder-1' },
    { valor: 2, etiqueta: 'Kinder-2' },
    { valor: 3, etiqueta: 'Kinder-3' },
  ],
  3: [
    { valor: 1, etiqueta: '1° de Primaria' },
    { valor: 2, etiqueta: '2° de Primaria' },
    { valor: 3, etiqueta: '3° de Primaria' },
    { valor: 4, etiqueta: '4° de Primaria' },
    { valor: 5, etiqueta: '5° de Primaria' },
    { valor: 6, etiqueta: '6° de Primaria' },
  ],
  4: [
    { valor: 1, etiqueta: '7mo' },
    { valor: 2, etiqueta: '8vo' },
    { valor: 3, etiqueta: '9no' },
  ],
}

export function parseGradoEscolar(
  grado: string | number | null | undefined
): number | null {
  if (grado == null || grado === '') return null
  const n = typeof grado === 'number' ? grado : parseInt(String(grado), 10)
  return Number.isNaN(n) ? null : n
}

export function gradoOpcionesPorNivel(
  nivel: string | number | null | undefined
): GradoEscolarOpcion[] {
  const n = parseNivelEscolar(nivel)
  if (n == null || !(n in GRADOS_POR_NIVEL)) return []
  return GRADOS_POR_NIVEL[n as NivelEscolarValor]
}

export function etiquetaGradoEscolar(
  nivel: string | number | null | undefined,
  grado: string | number | null | undefined
): string {
  const g = parseGradoEscolar(grado)
  if (g == null) return ''
  const hit = gradoOpcionesPorNivel(nivel).find((o) => o.valor === g)
  return hit?.etiqueta ?? String(grado)
}

/** Valor de `alumno_grado` válido para el nivel; si no aplica, el primero del nivel. */
export function gradoEscolarPorDefecto(
  nivel: string | number | null | undefined,
  grado: string | number | null | undefined
): number {
  const opciones = gradoOpcionesPorNivel(nivel)
  if (opciones.length === 0) return 1
  const g = parseGradoEscolar(grado)
  if (g != null && opciones.some((o) => o.valor === g)) return g
  return opciones[0].valor
}
