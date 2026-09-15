import { requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError } from '@/lib/boletasApi'
import { cicloEscolarActualBoletas } from '@/lib/boletasCiclo'
import { generarPdfPrimariaEs } from '@/lib/boletasPrimariaEsService'

export async function GET(req: Request) {
  try {
    await requireBoletasSession(req)
    const url = new URL(req.url)
    const alumnoId = Number(url.searchParams.get('alumnoId'))
    const bimestre = Number(url.searchParams.get('bimestre') ?? 1)
    const ciclo = Number(url.searchParams.get('ciclo') ?? cicloEscolarActualBoletas())
    if (!alumnoId) {
      return Response.json({ error: 'alumnoId requerido' }, { status: 400 })
    }
    const buf = await generarPdfPrimariaEs({ alumnoId, bimestre, ciclo })
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="boleta_primaria_es_${alumnoId}_t${bimestre}_${ciclo}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    return jsonError(e)
  }
}
