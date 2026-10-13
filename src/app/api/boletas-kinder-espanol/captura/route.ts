import { NextResponse } from 'next/server'
import { requireAdmin, requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { cicloEscolarActualBoletas } from '@/lib/boletasCiclo'
import { capturaParaUi, guardarCaptura, obtenerCaptura } from '@/lib/boletasKinderEsService'

export async function GET(req: Request) {
  try {
    requireAdmin(await requireBoletasSession(req))
    const url = new URL(req.url)
    const alumnoId = Number(url.searchParams.get('alumnoId'))
    const bimestre = Number(url.searchParams.get('bimestre') ?? 1)
    const ciclo = Number(url.searchParams.get('ciclo') ?? cicloEscolarActualBoletas())
    if (!alumnoId) {
      return NextResponse.json({ error: 'alumnoId requerido' }, { status: 400 })
    }
    return jsonOk(capturaParaUi(await obtenerCaptura({ alumnoId, bimestre, ciclo })))
  } catch (e) {
    return jsonError(e)
  }
}

function valoresDeBody(raw: unknown): Record<number, string> {
  const out: Record<number, string> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    out[Number(k)] = String(v ?? '')
  }
  return out
}

export async function PUT(req: Request) {
  try {
    requireAdmin(await requireBoletasSession(req))
    const body = (await req.json()) as {
      alumnoId?: number
      bimestre?: number
      ciclo?: number
      academicos?: Record<number | string, string>
    }
    const alumnoId = Number(body.alumnoId)
    const bimestre = Number(body.bimestre ?? 1)
    const ciclo = Number(body.ciclo ?? cicloEscolarActualBoletas())
    if (!alumnoId) {
      return NextResponse.json({ error: 'alumnoId requerido' }, { status: 400 })
    }
    const result = await guardarCaptura({ alumnoId, bimestre, ciclo, valores: valoresDeBody(body.academicos) })
    return jsonOk({ ok: true, ...result })
  } catch (e) {
    return jsonError(e)
  }
}
