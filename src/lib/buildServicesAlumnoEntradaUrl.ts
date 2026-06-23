import type { AuthSession } from '@/lib/portalAuthService'
import { urlServicesAlumnoApp } from '@/lib/servicesAlumnoConfig'

/** Enlace SSO hacia `services` sin volver a pedir número de control. */
export function buildServicesAlumnoEntradaUrl(
  session: AuthSession,
  destino: string = '/services'
): string {
  const ref = String(session.alumno_ref ?? '').trim()
  if (!ref) {
    throw new Error('La sesión del alumno no incluye número de control.')
  }

  const base = urlServicesAlumnoApp()
  if (!base) {
    throw new Error(
      'Falta configurar NEXT_PUBLIC_SERVICES_ALUMNO_URL en Vercel (URL del portal services).'
    )
  }

  const params = new URLSearchParams({
    ref: ref.padStart(5, '0'),
    nombre: session.displayName.trim(),
    next: destino.startsWith('/') ? destino : `/${destino}`,
  })

  return `${base}/auth/entrada?${params.toString()}`
}
