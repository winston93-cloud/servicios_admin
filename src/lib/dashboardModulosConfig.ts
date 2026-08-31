/** Cheques — emisión y control (cheques_new en Vercel / InsForge). */
export function urlChequesApp(): string {
  const explicit = process.env.NEXT_PUBLIC_CHEQUES_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  // Producción Vercel (override con NEXT_PUBLIC_CHEQUES_URL si el dominio cambia).
  return 'https://cheques-new.vercel.app'
}

/** Contratos laborales — generación y gestión (contratos en Vercel). */
export function urlContratosApp(): string {
  const explicit = process.env.NEXT_PUBLIC_CONTRATOS_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  return 'https://contratos-chi.vercel.app'
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

/** Becas Panel — dashboard de revisión (admin con login en becas-renovacion). */
export function urlBecasPanelApp(): string {
  const explicit = process.env.NEXT_PUBLIC_BECAS_PANEL_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  return 'https://becas-renovacion.vercel.app/admin/login'
}

/** @deprecated Preferir urlBecasPanelApp (panel externo con login). */
export function urlBecasAdminPath(): string {
  return urlBecasPanelApp()
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

/** SSIW — salida a pie / entregas (override con NEXT_PUBLIC_SSIW_URL). */
export function urlSsiwApp(): string {
  const explicit = process.env.NEXT_PUBLIC_SSIW_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  return 'https://ssiw.vercel.app'
}

/** Login de entregas a pie (solo contraseña, personal). */
export function urlSsiwEntregaLogin(): string {
  return `${urlSsiwApp()}/entrega/login`
}
