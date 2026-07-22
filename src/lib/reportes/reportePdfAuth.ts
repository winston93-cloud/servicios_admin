import { createHmac } from 'crypto'

/**
 * Acceso por clave compartida solo en la URL pública `/dif2`
 * (p. ej. enlace del jefe). Desde /reportes el mismo reporte sale
 * por `/api/reportes/insc-admin-dif2` sin esta clave.
 */
export const REPORTE_PDF_CLAVE = 'admin123'

export const DIF2_AUTH_COOKIE = 'dif2_reporte_auth'

export function claveReportePdfValida(clave: string | null | undefined): boolean {
  return String(clave ?? '').trim() === REPORTE_PDF_CLAVE
}

export function tokenCookieDif2(): string {
  return createHmac('sha256', REPORTE_PDF_CLAVE).update('dif2-acceso-v1').digest('hex')
}

export function cookieDif2Valida(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${DIF2_AUTH_COOKIE}=([^;]*)`)
  )
  if (!match?.[1]) return false
  try {
    return decodeURIComponent(match[1]) === tokenCookieDif2()
  } catch {
    return false
  }
}

export function opcionesCookieDif2(): {
  name: string
  value: string
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax'
  path: string
  maxAge: number
} {
  return {
    name: DIF2_AUTH_COOKIE,
    value: tokenCookieDif2(),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  }
}
