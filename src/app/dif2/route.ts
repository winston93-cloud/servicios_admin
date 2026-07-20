import { NextResponse } from 'next/server'
import { resolverCicloInscripcionSistemaValor } from '@/lib/ciclosEscolaresService'
import {
  autorizacionReportePdfValida,
  respuestaLoginReportePdf,
} from '@/lib/reportes/reportePdfAuth'
import { REPORTE_HANDLERS } from '@/lib/reportes/registry'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * URL corta para el PDF de Inscripciones admin (2º diferido).
 * Ej.: https://servicios-admin.vercel.app/dif2
 * Login: cualquier usuario / clave admin123
 */
export async function GET(request: Request) {
  try {
    const auth = request.headers.get('authorization')
    if (!autorizacionReportePdfValida(auth)) {
      return respuestaLoginReportePdf()
    }

    const { searchParams } = new URL(request.url)
    const ciclo =
      searchParams.get('ciclo')?.trim() ||
      String(await resolverCicloInscripcionSistemaValor())

    const params = new URLSearchParams({
      ciclo,
      format: searchParams.get('format') === 'html' ? 'html' : 'pdf',
    })

    const handler = REPORTE_HANDLERS['insc-admin-dif2']
    if (!handler) {
      return NextResponse.json({ error: 'Reporte no disponible' }, { status: 404 })
    }

    const result = await handler(params)

    if (result.pdf) {
      return new NextResponse(new Uint8Array(result.pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${result.filename}"`,
          'Cache-Control': 'private, no-store',
        },
      })
    }

    return new NextResponse(result.html ?? '', {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al generar reporte'
    console.error('GET /dif2:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
