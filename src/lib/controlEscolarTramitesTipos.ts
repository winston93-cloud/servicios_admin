export const CONCEPTOS_TRAMITE_CONTROL_ESCOLAR = [3, 4, 7, 10, 11, 19] as const

export type DashboardTramiteCe = 'kinder' | 'primaria' | 'secundaria'
export type EstadoTramiteCe = 'pendiente' | 'liberado' | 'cancelado'

export type FilaTramiteAdministrativo = {
  id: number
  pagoId: number
  alumnoId: number
  alumnoRef: string
  nombre: string
  conceptoId: number
  conceptoNombre: string
  pagoFolio: number | null
  cicloValor: number | null
  nivel: number | null
  nivelEtiqueta: string
  gradoEtiqueta: string
  grupoEtiqueta: string
  dashboard: DashboardTramiteCe | null
  urgente: boolean
  estado: EstadoTramiteCe
  creadoAt: string
  correoAvisoAt: string | null
  recordatorioAt: string | null
  liberadoAt: string | null
  liberadoPor: string | null
}

export function esConceptoTramiteControlEscolar(conceptoId: number): boolean {
  return (CONCEPTOS_TRAMITE_CONTROL_ESCOLAR as readonly number[]).includes(
    Number(conceptoId)
  )
}

export function dashboardTramitePorNivel(
  nivel: number | null | undefined
): DashboardTramiteCe | null {
  const n = Number(nivel)
  if (n === 1 || n === 2) return 'kinder'
  if (n === 3) return 'primaria'
  if (n === 4) return 'secundaria'
  return null
}

export function etiquetaDashboardTramite(d: DashboardTramiteCe): string {
  if (d === 'kinder') return 'Kinder / Maternal'
  if (d === 'primaria') return 'Primaria'
  return 'Secundaria'
}
