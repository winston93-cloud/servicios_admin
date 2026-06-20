import { NextResponse } from 'next/server'
import { cargarReporteBecados } from '@/lib/reporteBecadosService'
import { construirHtmlReporteBecados } from '@/lib/reporteBecadosDocument'
import { generarPdfReporteBecados } from '@/lib/reporteBecadosPdf'
import { REPORTE_BECADOS_CICLO_DEFAULT } from '@/lib/reportesConfig'

export const runtime = 'nodejs'
export const maxDuration = 60

function parseCiclo(value: string | null): number | null {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ciclo = parseCiclo(searchParams.get('ciclo')) ?? REPORTE_BECADOS_CICLO_DEFAULT
    const format = (searchParams.get('format') ?? 'html').toLowerCase()

    const resumen = await cargarReporteBecados(ciclo)

    if (format === 'pdf') {
      const pdf = generarPdfReporteBecados(resumen)
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="becados-ciclo-${ciclo}.pdf"`,
          'Cache-Control': 'private, no-store',
        },
      })
    }

    const html = construirHtmlReporteBecados(resumen)
    return new NextResponse(html, {
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
