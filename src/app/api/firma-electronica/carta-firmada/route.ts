import { NextRequest, NextResponse } from 'next/server'
import { validarAlumnoPortal } from '@/lib/portalApiAlumnoAuth'
import { createDbAdmin, createInsforgeAdmin } from '@/lib/insforgeAdmin'
import { obtenerAutorizacionFirmaActiva } from '@/lib/firmaElectronica/autorizacionFirmaService'
import { descargarCartaFirmadaPdf } from '@/lib/firmaElectronica/cartaFirmadaStorage'

export const runtime = 'nodejs'

/**
 * Descarga la carta firmada del alumno (si ya activó).
 * GET ?alumnoId=
 */
export async function GET(request: NextRequest) {
  try {
    const alumnoId = Number(request.nextUrl.searchParams.get('alumnoId'))
    const auth = await validarAlumnoPortal(alumnoId)
    if (!auth.ok) return auth.response

    const db = createDbAdmin()
    const row = await obtenerAutorizacionFirmaActiva(db, alumnoId)
    if (!row?.beca_activada || !row.carta_firmada_key) {
      return NextResponse.json(
        { error: 'Aún no hay carta firmada.' },
        { status: 404 }
      )
    }

    const client = createInsforgeAdmin()
    const bytes = await descargarCartaFirmadaPdf(client, row.carta_firmada_key)
    if (!bytes) {
      return NextResponse.json(
        { error: 'No se pudo leer la carta firmada.' },
        { status: 502 }
      )
    }

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          'inline; filename="carta-aceptacion-beca-firmada.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Error al descargar carta firmada'
    console.error('firma-electronica/carta-firmada:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
