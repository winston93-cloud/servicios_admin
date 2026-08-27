import { NextResponse } from 'next/server'
import { validarAlumnoPortal } from '@/lib/portalApiAlumnoAuth'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { resolverAutorizacionFirmaParaAlumno } from '@/lib/firmaElectronica/autorizacionFirmaService'
import {
  mensajeTarjetaBecaPortalPendiente,
  tarjetaBecaPortalDisponible,
} from '@/lib/firmaElectronica/disponibilidadTarjetaBecaPortal'
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
    const estado = await resolverAutorizacionFirmaParaAlumno(db, alumnoId)
    if (!estado.autorizada || !estado.flujo || !estado.expedienteId) {
      return NextResponse.json(
        { error: 'No hay beca autorizada para firmar.' },
        { status: 403 }
      )
    }

    if (!tarjetaBecaPortalDisponible()) {
      return NextResponse.json(
        { error: mensajeTarjetaBecaPortalPendiente() },
        { status: 403 }
      )
    }

    const row = estado.row

    const built = await construirCartaAceptacionPayload({
      db,
      flujo: estado.flujo,
      expedienteId: estado.expedienteId,
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
      activada: Boolean(estado.activada ?? row?.beca_activada),
      flujo: estado.flujo,
      expedienteId: estado.expedienteId,
    })
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Error al generar carta del alumno'
    console.error('firma-electronica/carta-alumno:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
