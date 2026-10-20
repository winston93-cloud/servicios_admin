import { NextResponse, after } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { alumnosSinPagoInscripcion, cicloActualAlertaInscripcion } from '@/lib/inscripcionSinPagoAlerta'
import { revisarAvisosInscripcionSinPagoSeguro } from '@/lib/inscripcionSinPagoAvisos'
import { reglaAvisoInscripcion } from '@/lib/inscripcionSinPagoNiveles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Alumnos sin pagar inscripción para el popup del dashboard: más de 15 días a control escolar, más de 45 a las
 * directoras, cada quien su nivel.
 * De paso sincroniza avisos por correo/notificación.
 */
export async function GET(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  const regla = reglaAvisoInscripcion(Number(auth.session.usuario_id) || 0)
  if (!regla) return NextResponse.json({ alumnos: [] })
  try {
    const ciclo = await cicloActualAlertaInscripcion()
    const alumnos = await alumnosSinPagoInscripcion(regla.niveles, ciclo, regla.dias)
    after(revisarAvisosInscripcionSinPagoSeguro)
    return NextResponse.json({ ciclo: ciclo.nombre, dias: regla.dias, etapa: regla.etapa, alumnos })
  } catch (e) {
    console.error('GET /api/control-escolar/alertas-inscripcion:', e)
    return NextResponse.json({ alumnos: [], error: 'No se pudo revisar inscripciones' }, { status: 500 })
  }
}
