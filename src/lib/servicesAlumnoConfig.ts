/** URL base del portal de alumnos (app `services` — Desayunos, Estancias y Comidas). */
export function urlServicesAlumnoApp(): string {
  const explicit = process.env.NEXT_PUBLIC_SERVICES_ALUMNO_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3002'
  }

  return ''
}
