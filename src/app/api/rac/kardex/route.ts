import { NextResponse } from 'next/server'
import { jsonRacError, requireRacSession } from '@/lib/racAuth'
import { puedeKardexRac } from '@/lib/racPermisos'
import { pdfKardex } from '@/lib/rac/racKardexPdf'
import { kardexGrupo } from '@/lib/racService'

export async function GET(req: Request) {
  try {
    const session = await requireRacSession(req)
    if (!puedeKardexRac(session.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    const url = new URL(req.url)
    const alumnoId = Number(url.searchParams.get('alumnoId') || 0) || undefined
    const datos = await kardexGrupo({
      grado: Number(url.searchParams.get('grado') || 0),
      grupoLetra: url.searchParams.get('grupo') ?? '',
      alumnoId,
    })
    if (url.searchParams.get('formato') !== 'pdf') return NextResponse.json(datos)
    if (alumnoId && !datos.alumnos.length) {
      return NextResponse.json({ error: 'El alumno no está en ese grupo' }, { status: 404 })
    }
    const nombre = alumnoId ? `kardex-${alumnoId}` : `kardex-${datos.grupoEtiqueta.replace(/\s+/g, '-')}`
    return new NextResponse(new Uint8Array(pdfKardex(datos)), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nombre}.pdf"`,
      },
    })
  } catch (e) {
    const { error, status } = jsonRacError(e)
    return NextResponse.json({ error }, { status })
  }
}
