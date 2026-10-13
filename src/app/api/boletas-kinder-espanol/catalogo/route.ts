import { requireAdmin, requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import {
  eliminarIndicadorKinderEs,
  guardarIndicadorKinderEs,
  listarIndicadoresKinderEs,
} from '@/lib/boletasKinderEsIndicadores'

export const dynamic = 'force-dynamic'

/** Campos académicos de la boleta de Kinder Español, por grado. */
export async function GET(req: Request) {
  try {
    requireAdmin(await requireBoletasSession(req))
    return jsonOk({ indicadores: await listarIndicadoresKinderEs() })
  } catch (e) {
    return jsonError(e)
  }
}

export async function POST(req: Request) {
  try {
    requireAdmin(await requireBoletasSession(req))
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const indicador = await guardarIndicadorKinderEs({
      grado: body.grado,
      id: body.id,
      nombre: body.nombre,
      orden: body.orden,
      activo: body.activo,
    })
    return jsonOk({ indicador })
  } catch (e) {
    return jsonError(e, 400)
  }
}

export async function DELETE(req: Request) {
  try {
    requireAdmin(await requireBoletasSession(req))
    const url = new URL(req.url)
    await eliminarIndicadorKinderEs({ grado: url.searchParams.get('grado'), id: url.searchParams.get('id') })
    return jsonOk({ ok: true })
  } catch (e) {
    return jsonError(e, 400)
  }
}
