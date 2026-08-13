import { requireAdmin, requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { cicloEscolarActualBoletas } from '@/lib/boletasCiclo'
import { enviarBoletasMasivo } from '@/lib/boletasEmail'

export async function POST(req: Request) {
  try {
    const session = await requireBoletasSession(req)
    requireAdmin(session)
    const body = (await req.json()) as {
      ciclo?: number
      grado?: number
      grupo?: number
      periodo?: number
      dryRun?: boolean
      limit?: number
    }
    const result = await enviarBoletasMasivo({
      ciclo: Number(body.ciclo ?? cicloEscolarActualBoletas()),
      grado: body.grado ? Number(body.grado) : undefined,
      grupo: body.grupo ? Number(body.grupo) : undefined,
      periodo: body.periodo ? Number(body.periodo) : undefined,
      dryRun: Boolean(body.dryRun),
      limit: body.limit ? Number(body.limit) : undefined,
    })
    return jsonOk({ ok: true, ...result })
  } catch (e) {
    return jsonError(e)
  }
}
