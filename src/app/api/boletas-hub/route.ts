import { requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { estadoHubBoletas } from '@/lib/boletasHubEstado'

export const dynamic = 'force-dynamic'

/** Avance del trimestre por nivel para el tablero de /boletas (personal de boletas). */
export async function GET(req: Request) {
  try {
    await requireBoletasSession(req)
    return jsonOk(await estadoHubBoletas())
  } catch (e) {
    return jsonError(e)
  }
}
