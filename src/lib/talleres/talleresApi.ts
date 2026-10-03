import { NextResponse } from 'next/server'
import type { AuthSession } from '@/lib/portalAuthService'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { sesionPortalDeRequest } from '@/lib/portalSesionFirmada'
import { modulosVisiblesDeUsuario } from '@/lib/dashboardAccesosEmpleados'
import { obtenerModulosDashboardUsuario } from '@/lib/usuarioCatalogoService'
import { TalleresError } from '@/lib/talleres/talleresService'

/** Mismo id que la tarjeta del dashboard: quien la ve (catálogo de usuarios o lista legada) administra Talleres. */
const MODULO_TALLERES = 'talleres-clases-especiales'

async function tieneModuloTalleres(session: AuthSession): Promise<boolean> {
  const uid = Number(session.usuario_id) || 0
  if (!uid) return false
  return modulosVisiblesDeUsuario(uid, await obtenerModulosDashboardUsuario(uid)).includes(MODULO_TALLERES)
}

export async function requireAdminTalleres(
  request: Request
): Promise<{ ok: true; session: AuthSession } | { ok: false; response: NextResponse }> {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth
  try {
    if (await tieneModuloTalleres(auth.session)) return auth
  } catch (e) {
    console.error('Permiso Talleres:', e)
    return {
      ok: false,
      response: NextResponse.json({ error: 'No se pudo validar tu permiso. Intenta de nuevo.' }, { status: 503 }),
    }
  }
  return {
    ok: false,
    response: NextResponse.json({ error: 'No tienes permiso para administrar Talleres.' }, { status: 403 }),
  }
}

/** Sesión de quien administra Talleres, o null (estancia sin sesión, otros empleados). No lanza. */
export async function adminTalleresOpcional(request: Request): Promise<AuthSession | null> {
  const session = sesionPortalDeRequest(request)
  if (session?.role !== 'usuario') return null
  try {
    return (await tieneModuloTalleres(session)) ? session : null
  } catch {
    return null
  }
}

/** Body JSON que sea objeto plano; si no, 400. */
export async function leerCuerpo(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new TalleresError('Solicitud inválida.', 400)
  }
  return body as Record<string, unknown>
}

/** Errores de negocio con su mensaje; fallos internos (BD, excepciones) solo a la bitácora. */
export function responderErrorTalleres(e: unknown, contexto: string): NextResponse {
  if (e instanceof TalleresError && e.status !== 500) {
    return NextResponse.json({ error: e.message, advertencias: e.advertencias }, { status: e.status })
  }
  console.error(contexto, e)
  return NextResponse.json({ error: 'Error del servidor. Intenta de nuevo en unos segundos.' }, { status: 500 })
}
