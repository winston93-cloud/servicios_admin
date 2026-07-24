/** Cheques — emisión y control (cheques_new en Vercel / InsForge). */
export function urlChequesApp(): string {
  const explicit = process.env.NEXT_PUBLIC_CHEQUES_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  // Producción Vercel (override con NEXT_PUBLIC_CHEQUES_URL si el dominio cambia).
  return 'https://cheques-new.vercel.app'
}

/** Boletas — captura y envío de boletas escolares (personal administrativo). */
export function urlBoletasApp(): string {
  const explicit = process.env.NEXT_PUBLIC_BOLETAS_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  return 'https://www.winston93.edu.mx/boletas'
}

/** Boletas — consulta para alumnos / familias. */
export function urlBoletasAlumnoApp(): string {
  const explicit = process.env.NEXT_PUBLIC_BOLETAS_ALUMNO_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  return urlBoletasApp()
}

/** Becas — módulo interno en /servicios. */
export function urlBecasAdminPath(): string {
  return '/servicios?modulo=becas'
}

/** Portal de becas integrales — solicitud en línea (alumnos / familias). */
export function urlBecasAlumnoApp(): string {
  const explicit = process.env.NEXT_PUBLIC_BECAS_ALUMNO_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  return 'https://winston93.edu.mx/becas'
}

/** Reportes de conducta — control escolar secundaria (legacy). */
export function urlReportesConductaApp(): string {
  const explicit = process.env.NEXT_PUBLIC_REPORTES_CONDUCTA_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  return 'https://www.winston93.edu.mx/secundaria_2.0'
}
