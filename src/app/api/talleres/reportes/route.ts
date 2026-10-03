import { NextResponse } from 'next/server'
import { requireAdminTalleres, responderErrorTalleres } from '@/lib/talleres/talleresApi'
import { reporteHorasMaestros } from '@/lib/talleres/talleresReportesService'
import { excelHorasMaestros } from '@/lib/talleres/talleresReporteExcel'
import { etiquetaNivel } from '@/lib/talleres/talleresTypes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireAdminTalleres(request)
  if (!auth.ok) return auth.response
  try {
    const url = new URL(request.url)
    const reporte = await reporteHorasMaestros({
      nivel: url.searchParams.get('nivel'),
      desde: url.searchParams.get('desde'),
      hasta: url.searchParams.get('hasta'),
    })
    if (url.searchParams.get('formato') !== 'xlsx') return NextResponse.json(reporte)

    const quien = auth.session.displayName?.trim() || auth.session.usuario_username || 'Usuario'
    const archivo = await excelHorasMaestros(reporte, quien)
    const nombre = `Horas maestros talleres ${etiquetaNivel(reporte.nivel)} ${reporte.desde} a ${reporte.hasta}.xlsx`
    return new NextResponse(new Uint8Array(archivo), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return responderErrorTalleres(e, 'GET /api/talleres/reportes:')
  }
}
