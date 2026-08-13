import { requireAdmin, requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { progresoCaptura } from '@/lib/boletasAdminService'
import { cicloEscolarActualBoletas } from '@/lib/boletasCiclo'

export async function GET(req: Request) {
  try {
    const session = await requireBoletasSession(req)
    requireAdmin(session)
    const url = new URL(req.url)
    const ciclo = Number(url.searchParams.get('ciclo') ?? cicloEscolarActualBoletas())
    const periodo = Number(url.searchParams.get('periodo') ?? 1)
    return jsonOk({ progreso: await progresoCaptura(ciclo, periodo), ciclo, periodo })
  } catch (e) {
    return jsonError(e)
  }
}
