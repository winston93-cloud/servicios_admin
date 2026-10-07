import { NextResponse, after } from 'next/server'
import { requireAdminTalleres, responderErrorTalleres } from '@/lib/talleres/talleresApi'
import { gruposEnMinimo, revisarAlertasMinimoSeguro } from '@/lib/talleres/talleresAlertaMinimo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Grupos en su cupo mínimo (popup del dashboard). De paso sincroniza avisos por correo/notificación. */
export async function GET(request: Request) {
  const auth = await requireAdminTalleres(request)
  if (!auth.ok) return auth.response
  try {
    const { grupos } = await gruposEnMinimo()
    after(revisarAlertasMinimoSeguro)
    return NextResponse.json({ grupos })
  } catch (e) {
    return responderErrorTalleres(e, 'GET /api/talleres/alertas-minimo:')
  }
}
