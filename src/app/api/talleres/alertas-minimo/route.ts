import { NextResponse, after } from 'next/server'
import { requireAdminTalleres, responderErrorTalleres } from '@/lib/talleres/talleresApi'
import { gruposDelUsuario, gruposEnMinimo, revisarAlertasMinimoSeguro } from '@/lib/talleres/talleresAlertaMinimo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Grupos en su cupo mínimo del nivel del usuario (popup del dashboard). De paso sincroniza avisos por correo/notificación. */
export async function GET(request: Request) {
  const auth = await requireAdminTalleres(request)
  if (!auth.ok) return auth.response
  try {
    const { grupos } = await gruposEnMinimo()
    after(revisarAlertasMinimoSeguro)
    return NextResponse.json({ grupos: gruposDelUsuario(Number(auth.session.usuario_id) || 0, grupos) })
  } catch (e) {
    return responderErrorTalleres(e, 'GET /api/talleres/alertas-minimo:')
  }
}
