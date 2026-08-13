import { requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { opcionesCicloBoletas, cicloEscolarActualBoletas } from '@/lib/boletasCiclo'
import { obtenerBimestreActivo } from '@/lib/boletasCapturaService'
import { boletasEnvConfigured } from '@/lib/boletasInsforge'

export async function GET(req: Request) {
  try {
    const session = await requireBoletasSession(req)
    const bimestre = boletasEnvConfigured() ? await obtenerBimestreActivo() : null
    return jsonOk({
      role: session.role,
      id: session.id,
      nombre: session.nombre,
      usuario: session.usuario,
      cicloActual: cicloEscolarActualBoletas(),
      ciclos: opcionesCicloBoletas(),
      bimestre,
      envOk: boletasEnvConfigured(),
    })
  } catch (e) {
    return jsonError(e)
  }
}
