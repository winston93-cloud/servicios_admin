import { NextResponse } from 'next/server'
import { cfgDesdeRequestSlug, jsonRacNivelError, requireRacNivelSession } from '@/lib/rac/racAuthNivel'
import { pdfKardex } from '@/lib/rac/racKardexPdf'
import { puedeKardexNivel } from '@/lib/rac/racPermisosNivel'
import { getServiceForSlug } from '@/lib/rac/racServiceNivel'

type Params = { params: Promise<{ slug: string }> }

export async function GET(req: Request, { params }: Params) {
  try {
    const { slug } = await params
    const cfg = cfgDesdeRequestSlug(slug)
    const session = await requireRacNivelSession(cfg, req)
    if (!puedeKardexNivel(session.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    const url = new URL(req.url)
    const alumnoId = Number(url.searchParams.get('alumnoId') || 0) || undefined
    const datos = await getServiceForSlug(slug).kardexGrupo({
      nivelEscolar: Number(url.searchParams.get('nivelEscolar') || 0),
      grado: Number(url.searchParams.get('grado') || 0),
      grupoLetra: url.searchParams.get('grupo') ?? '',
      alumnoId,
    })
    if (url.searchParams.get('formato') !== 'pdf') return NextResponse.json(datos)
    if (alumnoId && !datos.alumnos.length) {
      return NextResponse.json({ error: 'El alumno no está en ese grupo' }, { status: 404 })
    }
    const nombre = alumnoId ? `kardex-${alumnoId}` : `kardex-${slug}`
    return new NextResponse(new Uint8Array(pdfKardex(datos)), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nombre}.pdf"`,
      },
    })
  } catch (e) {
    const { error, status } = jsonRacNivelError(e)
    return NextResponse.json({ error }, { status })
  }
}
