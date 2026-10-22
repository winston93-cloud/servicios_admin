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

/** Kiosk / admin de registro QR (qr-entrada). */
export function urlQrEntradaApp(): string {
  const explicit = process.env.NEXT_PUBLIC_QR_ENTRADA_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  return 'https://winston-registro.vercel.app'
}

export function urlLoginQrEntrada(): string {
  return `${urlQrEntradaApp()}/login`
}

/**
 * Dirección y sistemas/DG que ven la tarjeta y entran al admin con SSO.
 * 7 coordprim, 8 coordkin, 10 coording, 13 josefina/secundaria, 54 kinder inglés;
 * 2 laura, 6 kevin, 17 mario, 59 santiago (DG).
 */
export const QR_ENTRADA_SSO_USUARIOS = [2, 6, 7, 8, 10, 13, 17, 54, 59] as const

const NIVEL_SSO_QR_ENTRADA: Record<number, '' | 'educativo' | '3' | '4'> = {
  8: 'educativo',
  54: 'educativo',
  7: '3',
  10: '3',
  13: '4',
}

export function puedeSsoQrEntrada(usuarioId: number | null | undefined): boolean {
  const uid = Number(usuarioId) || 0
  return uid > 0 && (QR_ENTRADA_SSO_USUARIOS as readonly number[]).includes(uid)
}

export function nivelSsoQrEntrada(usuarioId: number): '' | 'educativo' | '3' | '4' {
  return NIVEL_SSO_QR_ENTRADA[usuarioId] ?? ''
}

/** Programa USA / Winston–Hökku Academy (usa-program en Vercel). */
export function urlUsaProgramApp(): string {
  const explicit = process.env.NEXT_PUBLIC_USA_PROGRAM_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  return 'https://winston-usa-program.vercel.app'
}
