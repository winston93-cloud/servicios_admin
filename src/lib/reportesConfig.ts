export const REPORTE_ALUMNOS_CICLO_23_PATH = '/reportes/alumnos-ciclo-23.pdf'

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
