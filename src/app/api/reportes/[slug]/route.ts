import { NextResponse } from 'next/server'
import { REPORTE_HANDLERS } from '@/lib/reportes/registry'
import {
  autorizacionReportePdfValida,
  reporteRequiereClave,
  respuestaLoginReportePdf,
} from '@/lib/reportes/reportePdfAuth'

export const runtime = 'nodejs'
export const maxDuration = 60

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params
    const handler = REPORTE_HANDLERS[slug]

    if (!handler) {
      return NextResponse.json(
        {
          error: `Reporte "${slug}" aún no está migrado al stack nativo.`,
          hint: 'Consulta /reportes para ver los disponibles.',
        },
        { status: 404 }
      )
    }

    if (reporteRequiereClave(slug)) {
      const auth = request.headers.get('authorization')
      if (!autorizacionReportePdfValida(auth)) {
        return respuestaLoginReportePdf()
      }
    }

    const { searchParams } = new URL(request.url)
    const result = await handler(searchParams)

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
    const raw = e instanceof Error ? e.message : 'Error al generar reporte'
    const msg = raw.includes('502 Bad Gateway')
      ? 'InsForge no respondió a tiempo (502). Intenta de nuevo en unos segundos o usa formato HTML.'
      : raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || 'Error al generar reporte'
    console.error('GET /api/reportes/[slug]:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
