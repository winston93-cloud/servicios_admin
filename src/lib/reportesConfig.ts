export const REPORTE_ALUMNOS_CICLO_23_PATH = '/reportes/alumnos-ciclo-23.pdf'
export const REPORTE_BECADOS_API_PATH = '/api/reportes/becados'
export const REPORTE_BECADOS_CICLO_DEFAULT = 22

export function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`

  return 'https://servicios-admin.vercel.app'
}

export function reporteAlumnosCiclo23Url(): string {
  return `${appBaseUrl()}${REPORTE_ALUMNOS_CICLO_23_PATH}`
}

export function reporteBecadosUrl(
  ciclo: number = REPORTE_BECADOS_CICLO_DEFAULT,
  format: 'html' | 'pdf' = 'html'
): string {
  const params = new URLSearchParams({ ciclo: String(ciclo) })
  if (format === 'pdf') params.set('format', 'pdf')
  return `${appBaseUrl()}${REPORTE_BECADOS_API_PATH}?${params.toString()}`
}
