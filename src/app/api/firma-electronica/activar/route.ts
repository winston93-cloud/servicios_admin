import { NextResponse } from 'next/server'
import { validarAlumnoPortal } from '@/lib/portalApiAlumnoAuth'
import { createDbAdmin, createInsforgeAdmin } from '@/lib/insforgeAdmin'
import { activarBecaConCartaFirmada } from '@/lib/firmaElectronica/autorizacionFirmaService'

export const runtime = 'nodejs'

/**
 * Persiste PDF firmado y marca beca activada.
 * POST { alumnoId, firmadoPor, pdfBase64 }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const alumnoId = Number(body.alumnoId)
    const firmadoPor = String(body.firmadoPor || '').trim()
    const pdfBase64 = String(body.pdfBase64 || '').replace(/\s/g, '')

    const auth = await validarAlumnoPortal(alumnoId)
    if (!auth.ok) return auth.response

    if (!pdfBase64) {
      return NextResponse.json(
        { error: 'Falta el PDF firmado.' },
        { status: 400 }
      )
    }

    let pdfBytes: Uint8Array
    try {
      pdfBytes = new Uint8Array(Buffer.from(pdfBase64, 'base64'))
    } catch {
      return NextResponse.json(
        { error: 'PDF firmado inválido.' },
        { status: 400 }
      )
    }

    if (pdfBytes.byteLength < 100) {
      return NextResponse.json(
        { error: 'PDF firmado vacío o corrupto.' },
        { status: 400 }
      )
    }

    const db = createDbAdmin()
    const client = createInsforgeAdmin()
    const result = await activarBecaConCartaFirmada({
      db,
      client,
      alumnoId,
      firmadoPor,
      pdfBytes,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      activada: true,
      activadaEn: result.row.beca_activada_en,
      firmadoPor: result.row.firmado_por,
    })
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Error al activar beca con carta firmada'
    console.error('firma-electronica/activar:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
