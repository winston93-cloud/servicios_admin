import { requireAdmin, requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import {
  eliminarAsignacionGrupo,
  listarAsignacionesGrupos,
  upsertAsignacionGrupo,
} from '@/lib/boletasAdminService'

export async function GET(req: Request) {
  try {
    const session = await requireBoletasSession(req)
    requireAdmin(session)
    return jsonOk({ grupos: await listarAsignacionesGrupos() })
  } catch (e) {
    return jsonError(e)
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireBoletasSession(req)
    requireAdmin(session)
    const body = await req.json()
    if (body?.delete && body.grupo_id) {
      await eliminarAsignacionGrupo(Number(body.grupo_id))
      return jsonOk({ ok: true, deleted: true })
    }
    const row = await upsertAsignacionGrupo(body)
    return jsonOk({ ok: true, grupo: row })
  } catch (e) {
    return jsonError(e)
  }
}
