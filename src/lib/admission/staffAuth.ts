import { cookies } from 'next/headers'
import { parsePortalSessionHeader } from '@/lib/insforgeDbProxyShared'

export const STAFF_SESSION_COOKIE = 'staff_session'
export const ADMIN_SESSION_COOKIE = 'admin_session'
export const DIRECTOR_SESSION_COOKIE = 'director_session'

export async function hasStaffSession(): Promise<boolean> {
  const cookieStore = await cookies()
  if (cookieStore.get(STAFF_SESSION_COOKIE)?.value === '1') return true
  const portal = cookieStore.get('portal_auth_session')?.value
  const session = parsePortalSessionHeader(portal ?? null)
  return session?.role === 'usuario'
}

export function staffSessionFromRequest(request: Request): boolean {
  if (request.headers.get('x-staff-session') === '1') return true
  const portal = request.headers.get('x-portal-session')
  const session = parsePortalSessionHeader(portal)
  return session?.role === 'usuario'
}
