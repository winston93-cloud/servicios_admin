import type { AuthSession } from '@/lib/portalAuthService'
import { parsePortalSessionHeader } from '@/lib/insforgeDbProxyShared'
import { NextResponse } from 'next/server'

/** Rutas internas: solo sesión de personal (`role: usuario`), no papás/alumnos. */
export function requireEmpleadoPortal(
  request: Request
): { ok: true; session: AuthSession } | { ok: false; response: NextResponse } {
  const session = parsePortalSessionHeader(
    request.headers.get('x-portal-session')
  )
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Debe iniciar sesión como personal administrativo.' },
        { status: 401 }
      ),
    }
  }
  if (session.role !== 'usuario') {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: 'Esta función es solo para empleados. Los papás no tienen acceso.',
        },
        { status: 403 }
      ),
    }
  }
  return { ok: true, session }
}
