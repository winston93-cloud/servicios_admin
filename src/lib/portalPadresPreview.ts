import type { AuthSession } from '@/lib/portalAuthService'

/** kevin (6) y mario / sistemas.desarrollo (17). */
export const PORTAL_PADRES_PREVIEW_IDS = [6, 17] as const

/**
 * Números de control con módulos papás nuevos antes de la liberación general.
 * 29905 = LAURA PRUEBA PRUEBA (alumna ficticia de prueba).
 */
export const PORTAL_AUTORIZADOS_PREVIEW_REFS = [29905] as const

const PORTAL_PADRES_PREVIEW_USERNAMES = new Set([
  'kevin',
  'mario',
  'sistemas.desarrollo',
])

const PORTAL_AUTORIZADOS_PREVIEW_REF_SET = new Set<number>(PORTAL_AUTORIZADOS_PREVIEW_REFS)

function usernameNorm(valor: string | null | undefined): string {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
}

/** Liberación real a papás: `NEXT_PUBLIC_PORTAL_AUTORIZADOS_LIBERADO=1`. */
export function portalAutorizadosLiberado(): boolean {
  const v = process.env.NEXT_PUBLIC_PORTAL_AUTORIZADOS_LIBERADO?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'si' || v === 'sí'
}

/** Kevin y Mario ven el panel papás y el módulo nuevo sin abrirlo a familias. */
export function esStaffPreviewPanelPadres(
  session: Pick<AuthSession, 'role' | 'usuario_id' | 'usuario_username'> | null | undefined
): boolean {
  if (!session || session.role !== 'usuario') return false
  const uid = Number(session.usuario_id)
  if (PORTAL_PADRES_PREVIEW_IDS.includes(uid as (typeof PORTAL_PADRES_PREVIEW_IDS)[number])) {
    return true
  }
  return PORTAL_PADRES_PREVIEW_USERNAMES.has(usernameNorm(session.usuario_username))
}

export function puedeVerPanelPadresPreview(
  session: AuthSession | null | undefined
): boolean {
  return esStaffPreviewPanelPadres(session)
}

export function esAlumnoPreviewPortalAutorizados(
  session: Pick<AuthSession, 'role' | 'alumno_ref'> | null | undefined
): boolean {
  if (!session || session.role !== 'alumno') return false
  const ref = Number(session.alumno_ref)
  return Number.isFinite(ref) && PORTAL_AUTORIZADOS_PREVIEW_REF_SET.has(ref)
}

/** Tarjeta y ruta `/portal-autorizados`. Papás solo cuando el flag esté en 1. */
export function puedeVerModuloPortalAutorizados(
  session: AuthSession | null | undefined
): boolean {
  if (!session) return false
  if (esStaffPreviewPanelPadres(session)) return true
  if (esAlumnoPreviewPortalAutorizados(session)) return true
  return session.role === 'alumno' && portalAutorizadosLiberado()
}

export function puedeUsarApiPortalAutorizados(
  session: AuthSession | null | undefined
): boolean {
  return puedeVerModuloPortalAutorizados(session)
}
