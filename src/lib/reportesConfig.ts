import {
  cicloEscolarEtiqueta,
  cicloInscripcionDesdeTemporada,
  getCicloEscolarActual,
  getCicloEscolarDefault,
} from '@/lib/ciclosEscolares'

export const REPORTE_BECADOS_API_PATH = '/api/reportes/becados'

const LEGACY_BASE =
  process.env.NEXT_PUBLIC_REPORTES_LEGACY_BASE?.trim() ||
  'https://winston93.edu.mx/reportes'

export function reportesLegacyBaseUrl(): string {
  return LEGACY_BASE.replace(/\/$/, '')
}

export function reporteLegacyUrl(archivoPhp: string): string {
  const file = archivoPhp.replace(/^\//, '')
  return `${reportesLegacyBaseUrl()}/${file}`
}

/**
 * Fallback sync (calendario / env). En la UI de reportes el default de
 * becados usa `cicloActualSistema - 1` (becas suelen quedar en el ciclo
 * previo tras el avance de temporada).
 */
export function getCicloBecadosDefault(): number {
  return getCicloEscolarDefault()
}

export function reporteAlumnosCicloPdfPath(ciclo?: number): string {
  const n = ciclo ?? getCicloEscolarDefault()
  return `/reportes/alumnos-ciclo-${n}.pdf`
}

export function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`

  return 'https://servicios-admin.vercel.app'
}

export function reporteBecadosUrl(
  ciclo: number = getCicloBecadosDefault(),
  format: 'html' | 'pdf' = 'html'
): string {
  const params = new URLSearchParams({ ciclo: String(ciclo) })
  if (format === 'pdf') params.set('format', 'pdf')
  return `${appBaseUrl()}${REPORTE_BECADOS_API_PATH}?${params.toString()}`
}

export function etiquetaCicloReporte(
  tipo: 'escolar' | 'inscripcion' | 'libre' | undefined,
  cicloSeleccionado: number
): string {
  if (tipo === 'inscripcion') {
    return `Inscripción ${cicloEscolarEtiqueta(cicloSeleccionado)}`
  }
  if (tipo === 'escolar') {
    return `Ciclo ${cicloEscolarEtiqueta(cicloSeleccionado)}`
  }
  return `Ciclo ${cicloEscolarEtiqueta(cicloSeleccionado)}`
}

export function cicloSugeridoParaReporte(
  tipo: 'escolar' | 'inscripcion' | 'libre' | undefined,
  cicloTemporada?: number
): number {
  const origen = cicloTemporada ?? getCicloEscolarActual()
  if (tipo === 'inscripcion') return cicloInscripcionDesdeTemporada(origen)
  return origen
}

/** @deprecated usar reporteAlumnosCicloPdfPath */
export const REPORTE_ALUMNOS_CICLO_23_PATH = '/reportes/alumnos-ciclo-23.pdf'
export const REPORTE_BECADOS_CICLO_DEFAULT = getCicloBecadosDefault()

export function reporteAlumnosCiclo23Url(): string {
  return `${appBaseUrl()}${REPORTE_ALUMNOS_CICLO_23_PATH}`
}
