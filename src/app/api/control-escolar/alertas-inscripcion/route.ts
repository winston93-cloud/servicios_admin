import { NextResponse, after } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { alumnosSinPagoInscripcion, cicloActualAlertaInscripcion } from '@/lib/inscripcionSinPagoAlerta'
import { revisarAvisosInscripcionSinPagoSeguro } from '@/lib/inscripcionSinPagoAvisos'
import { nivelesAlertaInscripcion } from '@/lib/inscripcionSinPagoNiveles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Alumnos con más de 30 días de referencia sin pagar inscripción (popup del dashboard de control escolar).
 * De paso sincroniza avisos por correo/notificación.
 */
export async function GET(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  const niveles = nivelesAlertaInscripcion(Number(auth.session.usuario_id) || 0)
  if (!niveles.length) return NextResponse.json({ alumnos: [] })
  try {
    const ciclo = await cicloActualAlertaInscripcion()
    const alumnos = await alumnosSinPagoInscripcion(niveles, ciclo.valor)
    after(revisarAvisosInscripcionSinPagoSeguro)
    return NextResponse.json({ ciclo: ciclo.nombre, alumnos })
  } catch (e) {
    console.error('GET /api/control-escolar/alertas-inscripcion:', e)
    return NextResponse.json({ alumnos: [], error: 'No se pudo revisar inscripciones' }, { status: 500 })
  }
}
