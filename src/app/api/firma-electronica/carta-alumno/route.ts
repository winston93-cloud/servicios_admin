import { NextResponse } from 'next/server'
import { validarAlumnoPortal } from '@/lib/portalApiAlumnoAuth'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { obtenerAutorizacionFirmaActiva } from '@/lib/firmaElectronica/autorizacionFirmaService'
import { construirCartaAceptacionPayload } from '@/lib/firmaElectronica/cartaAceptacionPayload'
import { resolveFirmaAssetsBaseUrl } from '@/lib/firmaElectronica/resolveAssetsBaseUrl'
import { crearCartaBecaPdf } from '@/app/firma-electronica/lib/crearCartaBecaPdf'

export const runtime = 'nodejs'

/**
 * Genera la carta real del expediente autorizado (PDF + firmaBox) para el padre.
 * POST { alumnoId }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const alumnoId = Number(body.alumnoId)
    const auth = await validarAlumnoPortal(alumnoId)
    if (!auth.ok) return auth.response

    const db = createDbAdmin()
    const row = await obtenerAutorizacionFirmaActiva(db, alumnoId)
    if (!row) {
      return NextResponse.json(
        { error: 'No hay beca autorizada para firmar.' },
        { status: 403 }
      )
    }

    const built = await construirCartaAceptacionPayload({
      db,
      flujo: row.flujo,
      expedienteId: row.expediente_id,
    })
    if (!built.ok) {
      return NextResponse.json({ error: built.error }, { status: 400 })
    }

    const { bytes, firmaBox } = await crearCartaBecaPdf(
      built.data.nivel,
      built.data.datos,
      { assetsBaseUrl: resolveFirmaAssetsBaseUrl() }
    )

    return NextResponse.json({
      ok: true,
      nivel: built.data.nivel,
      datos: built.data.datos,
      firmaBox,
      pdfBase64: Buffer.from(bytes).toString('base64'),
      activada: Boolean(row.beca_activada),
      flujo: row.flujo,
      expedienteId: row.expediente_id,
    })
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Error al generar carta del alumno'
    console.error('firma-electronica/carta-alumno:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
