import { NextResponse } from 'next/server'
import { adminTalleresOpcional, leerCuerpo, responderErrorTalleres } from '@/lib/talleres/talleresApi'
import { asistenciaDelDia, guardarAsistencia, guardarIncidencia, quitarAsistencia } from '@/lib/talleres/talleresAsistenciaService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Pública: el personal de estancia pasa lista sin iniciar sesión. Solo toca asistencia e
// incidencias del maestro; grupos, horarios, maestros e inscripciones van por /api/talleres (admin).

const SIN_CACHE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }

export async function GET(request: Request) {
  try {
    const fecha = new URL(request.url).searchParams.get('fecha')
    return NextResponse.json(await asistenciaDelDia(fecha), { headers: SIN_CACHE })
  } catch (e) {
    return responderErrorTalleres(e, 'GET /api/talleres/asistencia:')
  }
}

export async function POST(request: Request) {
  try {
    const body = await leerCuerpo(request)
    const admin = await adminTalleresOpcional(request)
    if (admin?.displayName) body.registrado_por = admin.displayName
    if (body.accion === 'incidencia') {
      return NextResponse.json({ ok: true, incidencia: await guardarIncidencia(body) }, { headers: SIN_CACHE })
    }
    if (body.accion === 'quitar') {
      await quitarAsistencia(body)
      return NextResponse.json({ ok: true, registro: null }, { headers: SIN_CACHE })
    }
    return NextResponse.json({ ok: true, registro: await guardarAsistencia(body) }, { headers: SIN_CACHE })
  } catch (e) {
    return responderErrorTalleres(e, 'POST /api/talleres/asistencia:')
  }
}
