import { requireAdmin, requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { listarMaterias, upsertMateria } from '@/lib/boletasAdminService'

export async function GET(req: Request) {
  try {
    await requireBoletasSession(req)
    const grado = Number(new URL(req.url).searchParams.get('grado') || 0)
    return jsonOk({ materias: await listarMaterias(grado || undefined) })
  } catch (e) {
    return jsonError(e)
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireBoletasSession(req)
    requireAdmin(session)
    const body = await req.json()
    const row = await upsertMateria(body)
    return jsonOk({ ok: true, materia: row })
  } catch (e) {
    return jsonError(e)
  }
}
