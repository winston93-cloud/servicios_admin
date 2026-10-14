import { jsonError } from '@/lib/boletasApi'
import { capturaConfigDeSlug } from '@/lib/boletasCapturaAuth'
import { assertAlumnoDelGrupo, contextoCaptura } from '@/lib/boletasCapturaContexto'
import { generarPdfKinderEn } from '@/lib/boletasKinderEnService'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Params = { params: Promise<{ slug: string }> }

/** Vista previa en PDF de la boleta de un alumno del grupo de la teacher. */
export async function GET(req: Request, { params }: Params) {
  try {
    const cfg = capturaConfigDeSlug((await params).slug)
    const url = new URL(req.url)
    const ctx = await contextoCaptura(cfg, req, {
      grado: url.searchParams.get('grado'),
      grupo: url.searchParams.get('grupo'),
      trimestre: url.searchParams.get('trimestre'),
    })
    const alumnoId = Number(url.searchParams.get('alumnoId'))
    await assertAlumnoDelGrupo(ctx, alumnoId)
    const buf = await generarPdfKinderEn({ alumnoId, bimestre: ctx.trimestre, ciclo: ctx.ciclo })
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="boleta_kinder_en_${alumnoId}_t${ctx.trimestre}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    return jsonError(e, 400)
  }
}
