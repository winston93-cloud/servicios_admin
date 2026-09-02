import { NextResponse } from 'next/server'
import { jsonRacError, requireRacSession } from '@/lib/racAuth'
import { puedePdfRac } from '@/lib/racPermisos'
import { pdfHistorialAlumno, pdfReportesPendientes } from '@/lib/racPdf'
import { datosPdfHistorial, datosPdfPendientes } from '@/lib/racService'

export async function GET(req: Request) {
  try {
    const session = await requireRacSession(req)
    if (!puedePdfRac(session.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    const url = new URL(req.url)
    const modo = url.searchParams.get('modo') ?? 'pendientes'

    if (modo === 'historial') {
      const alumnoId = Number(url.searchParams.get('alumnoId'))
      const reporteTipo = Number(url.searchParams.get('reporteTipo') ?? 1)
      const materiaId = Number(url.searchParams.get('materiaId') ?? 0)
      if (!alumnoId) return NextResponse.json({ error: 'alumnoId requerido' }, { status: 400 })
      const datos = await datosPdfHistorial(
        alumnoId,
        reporteTipo,
        materiaId > 0 ? materiaId : undefined
      )
      const pdf = pdfHistorialAlumno(datos)
      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="rac-historial-${alumnoId}.pdf"`,
        },
      })
    }

    const datos = await datosPdfPendientes()
    const pdf = pdfReportesPendientes(datos)
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="rac-pendientes.pdf"',
      },
    })
  } catch (e) {
    const { error, status } = jsonRacError(e)
    return NextResponse.json({ error }, { status })
  }
}
