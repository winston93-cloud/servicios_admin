import { requireAdmin, requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { listarMaestros, upsertMaestro } from '@/lib/boletasAdminService'

export async function GET(req: Request) {
  try {
    const session = await requireBoletasSession(req)
    requireAdmin(session)
    return jsonOk({ maestros: await listarMaestros() })
  } catch (e) {
    return jsonError(e)
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireBoletasSession(req)
    requireAdmin(session)
    const body = await req.json()
    const row = await upsertMaestro(body)
    return jsonOk({ ok: true, maestro: row })
  } catch (e) {
    return jsonError(e)
  }
}
