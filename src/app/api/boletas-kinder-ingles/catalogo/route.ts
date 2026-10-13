import { requireAdmin, requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import {
  eliminarIndicadorKinderEn,
  esTipoKinderEn,
  guardarIndicadorKinderEn,
  listarIndicadoresKinderEn,
} from '@/lib/boletasKinderEnIndicadores'

export const dynamic = 'force-dynamic'

/** Catálogo de Subjects / Behavioral skills / Maternal (dirección de Kinder Inglés). */
export async function GET(req: Request) {
  try {
    requireAdmin(await requireBoletasSession(req))
    const tipo = new URL(req.url).searchParams.get('tipo')
    return jsonOk({ indicadores: await listarIndicadoresKinderEn(esTipoKinderEn(tipo) ? { tipo } : {}) })
  } catch (e) {
    return jsonError(e)
  }
}

export async function POST(req: Request) {
  try {
    requireAdmin(await requireBoletasSession(req))
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const indicador = await guardarIndicadorKinderEn({
      tipo: body.tipo,
      grado: body.grado,
      id: body.id,
      nombre: body.nombre,
      orden: body.orden,
      formato: body.formato,
      enPromedio: body.enPromedio,
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
    await eliminarIndicadorKinderEn({
      tipo: url.searchParams.get('tipo'),
      grado: url.searchParams.get('grado'),
      id: url.searchParams.get('id'),
    })
    return jsonOk({ ok: true })
  } catch (e) {
    return jsonError(e, 400)
  }
}
