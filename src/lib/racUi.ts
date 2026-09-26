import { opcionesMotivo } from '@/lib/racCatalogo'

export const RAC_TIPOS_CAPTURA_MAESTRO = [
  { valor: 1, etiqueta: 'Académico' },
  { valor: 2, etiqueta: 'Conducta' },
]

export const RAC_TIPOS_PREFECTURA = [
  { valor: 3, etiqueta: 'Uniforme' },
  { valor: 4, etiqueta: 'Vialidad' },
  { valor: 6, etiqueta: 'Retardo' },
]

/** Citatorios que captura psicología (legacy secundaria_2.0). */
export const RAC_TIPOS_CITA_PSICOLOGIA = [
  { valor: 2, etiqueta: 'Por Conducta' },
  { valor: 7, etiqueta: 'Por Seguimiento' },
]

/** Etiqueta de pestaña con total visible, p. ej. «Citatorios (5)». */
export function etiquetaTabConteo(label: string, n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return label
  return `${label} (${Number(n)})`
}

export { opcionesMotivo }

/** «Materia: X» si el reporte tiene asignatura; si no, «Expedido por: Nombre (Maestro)». */
export function origenReporteRac(row: Record<string, unknown>): { etiqueta: string; valor: string } | null {
  const valor = String(row.materia ?? '').trim()
  if (!valor) return null
  return { etiqueta: Number(row.materia_id) > 0 ? 'Materia' : 'Expedido por', valor }
}
