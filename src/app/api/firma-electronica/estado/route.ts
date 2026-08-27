import { NextResponse } from 'next/server'
import { validarAlumnoPortal } from '@/lib/portalApiAlumnoAuth'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { obtenerAutorizacionFirmaActiva } from '@/lib/firmaElectronica/autorizacionFirmaService'
import { cicloFirmaBecaActual } from '@/lib/firmaElectronica/cicloFirmaBeca'

export const runtime = 'nodejs'

/**
 * Estado de firma / activación de beca para el alumno de sesión (papás).
 * POST { alumnoId }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const alumnoId = Number(body.alumnoId)
    const auth = await validarAlumnoPortal(alumnoId)
    if (!auth.ok) return auth.response

    const db = createDbAdmin()
    const ciclo = cicloFirmaBecaActual()
    const row = await obtenerAutorizacionFirmaActiva(db, alumnoId, ciclo)

    if (!row) {
      return NextResponse.json({
        ok: true,
        autorizada: false,
        activada: false,
        ciclo,
      })
    }

    return NextResponse.json({
      ok: true,
      autorizada: true,
      activada: Boolean(row.beca_activada),
      ciclo: row.ciclo_escolar,
      flujo: row.flujo,
      expedienteId: row.expediente_id,
      firmadoPor: row.firmado_por,
      activadaEn: row.beca_activada_en,
      tieneCartaFirmada: Boolean(row.carta_firmada_key),
    })
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Error al consultar estado de firma'
    console.error('firma-electronica/estado:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
