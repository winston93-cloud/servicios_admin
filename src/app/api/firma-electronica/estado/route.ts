import { NextResponse } from 'next/server'
import { validarAlumnoPortal } from '@/lib/portalApiAlumnoAuth'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { resolverEstadoFirmaBecaPortal } from '@/lib/firmaElectronica/autorizacionFirmaService'

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
    const estado = await resolverEstadoFirmaBecaPortal(db, alumnoId)

    if (!estado.autorizada) {
      return NextResponse.json({
        ok: true,
        autorizada: false,
        activada: false,
        ciclo: estado.ciclo,
      })
    }

    return NextResponse.json({
      ok: true,
      autorizada: true,
      activada: Boolean(estado.activada),
      ciclo: estado.ciclo,
      flujo: estado.flujo,
      expedienteId: estado.expedienteId,
      firmadoPor: estado.firmadoPor ?? estado.row?.firmado_por ?? null,
      activadaEn: estado.activadaEn ?? estado.row?.beca_activada_en ?? null,
      tieneCartaFirmada: Boolean(
        estado.tieneCartaFirmada ?? estado.row?.carta_firmada_key
      ),
    })
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Error al consultar estado de firma'
    console.error('firma-electronica/estado:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
