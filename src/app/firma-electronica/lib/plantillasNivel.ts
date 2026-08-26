/**
 * 2026-08-21 - Niveles de carta de aceptación (sandbox firma electrónica).
 */

export type NivelFirma =
  | 'maternal-kinder'
  | 'primaria'
  | 'secundaria'

export type FirmaBox = {
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
  /** Fecha de firma: columna derecha; valor centrado y etiqueta debajo. */
  fechaCenterX: number
  fechaValorY: number
  fechaLabelY: number
  /** Nombre del tutor debajo de la línea de firma (coord. PDF, origen abajo-izq). */
  nombreY: number
  nombreMaxWidth: number
}

export type PlantillaNivel = {
  id: NivelFirma
  label: string
}

export const PLANTILLAS_NIVEL: PlantillaNivel[] = [
  { id: 'maternal-kinder', label: 'Maternal / Kinder' },
  { id: 'primaria', label: 'Primaria' },
  { id: 'secundaria', label: 'Secundaria' },
]

export function plantillaPorNivel(nivel: NivelFirma): PlantillaNivel {
  const found = PLANTILLAS_NIVEL.find((p) => p.id === nivel)
  if (!found) throw new Error(`Nivel no soportado: ${nivel}`)
  return found
}
