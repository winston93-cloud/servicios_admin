import { requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError } from '@/lib/boletasApi'
import { cicloEscolarActualBoletas } from '@/lib/boletasCiclo'
import { generarBoletaPdfBuffer } from '@/lib/boletasPdf'

export async function GET(req: Request) {
  try {
    await requireBoletasSession(req)
    const url = new URL(req.url)
    const alumnoId = Number(url.searchParams.get('alumnoId'))
    const ciclo = Number(url.searchParams.get('ciclo') ?? cicloEscolarActualBoletas())
    const periodoRaw = url.searchParams.get('periodo')
    const periodo = periodoRaw ? Number(periodoRaw) : undefined
    if (!alumnoId) {
      return Response.json({ error: 'alumnoId requerido' }, { status: 400 })
    }
    const buf = await generarBoletaPdfBuffer({ alumnoId, ciclo, periodo })
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="boleta_${alumnoId}_${ciclo}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    return jsonError(e)
  }
}
