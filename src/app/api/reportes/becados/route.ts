import { NextResponse } from 'next/server'
import { REPORTE_HANDLERS } from '@/lib/reportes/registry'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Ruta fija /api/reportes/becados (tiene prioridad sobre [slug]).
 * Delega al handler del registry: Winston + SEP, promedio ≥ 9, filtro por nivel.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const handler = REPORTE_HANDLERS.becados
    if (!handler) {
      return NextResponse.json({ error: 'Handler becados no registrado' }, { status: 500 })
    }

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
    const msg = e instanceof Error ? e.message : 'Error al generar reporte de becados'
    console.error('GET /api/reportes/becados:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
