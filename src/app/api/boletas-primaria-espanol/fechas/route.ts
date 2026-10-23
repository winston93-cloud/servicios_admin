import { jsonError, jsonOk } from '@/lib/boletasApi'
import { requireAdmin, requireBoletasSession } from '@/lib/boletasAuth'
import { fijarTrimestreFechas, obtenerTrimestreFechas } from '@/lib/boletasTrimestreFechas'

export const dynamic = 'force-dynamic'

const MODULO = 'primaria-es' as const

function cicloDe(raw: unknown): number {
  const ciclo = Number(raw)
  if (!Number.isInteger(ciclo) || ciclo <= 0) throw new Error('ciclo inválido')
  return ciclo
}

/** Fechas de inicio y fin de cada trimestre: Classroom solo cuenta las tareas con fecha dentro del trimestre. */
export async function GET(req: Request) {
  try {
    requireAdmin(await requireBoletasSession(req))
    const ciclo = cicloDe(new URL(req.url).searchParams.get('ciclo'))
    return jsonOk({ fechas: await obtenerTrimestreFechas(ciclo, MODULO) })
  } catch (e) {
    return jsonError(e, 400)
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireBoletasSession(req)
    requireAdmin(session)
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const ciclo = cicloDe(body.ciclo)
    const fechas = await fijarTrimestreFechas({ ciclo, modulo: MODULO, fechas: body.fechas, por: session.nombre || session.usuario })
    return jsonOk({ fechas })
  } catch (e) {
    return jsonError(e, 400)
  }
}
