import { NextResponse } from 'next/server'
import { adminTalleresOpcional, leerCuerpo, responderErrorTalleres } from '@/lib/talleres/talleresApi'
import { asistenciaDelDia, guardarAsistencia, guardarIncidencia } from '@/lib/talleres/talleresAsistenciaService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Pública para el día de hoy: el personal de estancia pasa lista sin iniciar sesión.
// Días anteriores solo con sesión de quien administra Talleres.

const SIN_CACHE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }

export async function GET(request: Request) {
  try {
    const admin = await adminTalleresOpcional(request)
    const fecha = new URL(request.url).searchParams.get('fecha')
    return NextResponse.json(await asistenciaDelDia(fecha, { historial: Boolean(admin) }), { headers: SIN_CACHE })
  } catch (e) {
    return responderErrorTalleres(e, 'GET /api/talleres/asistencia:')
  }
}

export async function POST(request: Request) {
  try {
    const body = await leerCuerpo(request)
    const admin = await adminTalleresOpcional(request)
    if (admin?.displayName) body.registrado_por = admin.displayName
    const acceso = { historial: Boolean(admin) }
    if (body.accion === 'incidencia') {
      return NextResponse.json({ ok: true, incidencia: await guardarIncidencia(body, acceso) }, { headers: SIN_CACHE })
    }
    return NextResponse.json({ ok: true, registro: await guardarAsistencia(body, acceso) }, { headers: SIN_CACHE })
  } catch (e) {
    return responderErrorTalleres(e, 'POST /api/talleres/asistencia:')
  }
}
