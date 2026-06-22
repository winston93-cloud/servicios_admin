import { NextResponse } from 'next/server'
import { REPORTE_HANDLERS } from '@/lib/reportes/registry'

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
    const msg = e instanceof Error ? e.message : 'Error al generar reporte'
    console.error('GET /api/reportes/[slug]:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
