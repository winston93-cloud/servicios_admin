import { NextResponse } from 'next/server'
import { cfgDesdeRequestSlug, jsonRacNivelError, requireRacNivelSession } from '@/lib/rac/racAuthNivel'
import { puedePdfNivel } from '@/lib/rac/racPermisosNivel'
import { getServiceForSlug } from '@/lib/rac/racServiceNivel'
import { pdfHistorialAlumno, pdfReportesPendientes } from '@/lib/racPdf'

type Params = { params: Promise<{ slug: string }> }

export async function GET(req: Request, { params }: Params) {
  try {
    const { slug } = await params
    const cfg = cfgDesdeRequestSlug(slug)
    const session = await requireRacNivelSession(cfg, req)
    if (!puedePdfNivel(session.role, cfg)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    const svc = getServiceForSlug(slug)
    const url = new URL(req.url)
    const modo = url.searchParams.get('modo') ?? 'pendientes'

    if (modo === 'historial') {
      const alumnoId = Number(url.searchParams.get('alumnoId'))
      const reporteTipo = Number(url.searchParams.get('reporteTipo') ?? 1)
      const materiaId = Number(url.searchParams.get('materiaId') ?? 0)
      if (!alumnoId) return NextResponse.json({ error: 'alumnoId requerido' }, { status: 400 })
      const datos = await svc.datosPdfHistorial(
        alumnoId,
        reporteTipo,
        materiaId > 0 ? materiaId : undefined
      )
      const pdf = pdfHistorialAlumno(datos)
      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="rac-${slug}-historial-${alumnoId}.pdf"`,
        },
      })
    }

    const datos = await svc.datosPdfPendientes()
    const pdf = pdfReportesPendientes(datos)
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rac-${slug}-pendientes.pdf"`,
      },
    })
  } catch (e) {
    const { error, status } = jsonRacNivelError(e)
    return NextResponse.json({ error }, { status })
  }
}
