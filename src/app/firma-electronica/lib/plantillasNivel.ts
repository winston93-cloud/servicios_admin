/**
 * 2026-08-21 - Plantillas PDF de carta de aceptación de beca por nivel (sandbox).
 * Maternal y Kinder comparten el mismo formato.
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
}

export type PlantillaNivel = {
  id: NivelFirma
  label: string
  /** Ruta pública del PDF de muestra */
  pdfUrl: string
  /** Caja aproximada sobre "Fecha y Firma de Enterado" (coords PDF). */
  firmaBox: FirmaBox
}

export const PLANTILLAS_NIVEL: PlantillaNivel[] = [
  {
    id: 'maternal-kinder',
    label: 'Maternal / Kinder',
    pdfUrl: '/firma-electronica/plantillas/maternal-kinder.pdf',
    // Línea de firma centrada sobre el pie verde / PREESCOLAR
    firmaBox: { pageIndex: 0, x: 170, y: 88, width: 260, height: 72 },
  },
  {
    id: 'primaria',
    label: 'Primaria',
    pdfUrl: '/firma-electronica/plantillas/primaria.pdf',
    // Zona inferior derecha (misma familia visual que secundaria)
    firmaBox: { pageIndex: 0, x: 310, y: 100, width: 230, height: 78 },
  },
  {
    id: 'secundaria',
    label: 'Secundaria',
    pdfUrl: '/firma-electronica/plantillas/secundaria.pdf',
    firmaBox: { pageIndex: 0, x: 300, y: 98, width: 230, height: 78 },
  },
]

export function plantillaPorNivel(nivel: NivelFirma): PlantillaNivel {
  const found = PLANTILLAS_NIVEL.find((p) => p.id === nivel)
  if (!found) throw new Error(`Nivel no soportado: ${nivel}`)
  return found
}
