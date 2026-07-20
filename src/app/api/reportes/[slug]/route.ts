import { NextResponse } from 'next/server'
import { REPORTE_HANDLERS } from '@/lib/reportes/registry'
import { cookieDif2Valida, reporteRequiereClave } from '@/lib/reportes/reportePdfAuth'

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

    // insc-admin-dif2: modal en /dif2 (sin Basic Auth del navegador)
    if (reporteRequiereClave(slug)) {
      if (!cookieDif2Valida(request.headers.get('cookie'))) {
        const q = new URLSearchParams()
        const ciclo = searchParams.get('ciclo')?.trim()
        if (ciclo) q.set('ciclo', ciclo)
        if (searchParams.get('format') === 'html') q.set('format', 'html')
        const dest = q.toString() ? `/dif2?${q}` : '/dif2'
        return NextResponse.redirect(new URL(dest, request.url), 302)
      }
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
    const raw = e instanceof Error ? e.message : 'Error al generar reporte'
    const msg = raw.includes('502 Bad Gateway')
      ? 'InsForge no respondió a tiempo (502). Intenta de nuevo en unos segundos o usa formato HTML.'
      : raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || 'Error al generar reporte'
    console.error('GET /api/reportes/[slug]:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
