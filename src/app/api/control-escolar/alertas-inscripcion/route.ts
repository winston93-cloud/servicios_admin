import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { alumnosSinPagoInscripcion } from '@/lib/inscripcionSinPagoAlerta'
import { nivelesAlertaInscripcion } from '@/lib/inscripcionSinPagoNiveles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Alumnos con más de 30 días de referencia sin pagar inscripción (popup del dashboard de control escolar). */
export async function GET(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  const niveles = nivelesAlertaInscripcion(Number(auth.session.usuario_id) || 0)
  if (!niveles.length) return NextResponse.json({ alumnos: [] })
  try {
    return NextResponse.json({ alumnos: await alumnosSinPagoInscripcion(niveles) })
  } catch (e) {
    console.error('GET /api/control-escolar/alertas-inscripcion:', e)
    return NextResponse.json({ alumnos: [], error: 'No se pudo revisar inscripciones' }, { status: 500 })
  }
}
