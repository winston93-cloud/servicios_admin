import { NextResponse } from 'next/server'
import { requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { cicloEscolarActualBoletas } from '@/lib/boletasCiclo'
import { guardarCaptura, obtenerCaptura } from '@/lib/boletasKinderEsService'

export async function GET(req: Request) {
  try {
    await requireBoletasSession(req)
    const url = new URL(req.url)
    const alumnoId = Number(url.searchParams.get('alumnoId'))
    const bimestre = Number(url.searchParams.get('bimestre') ?? 1)
    const ciclo = Number(url.searchParams.get('ciclo') ?? cicloEscolarActualBoletas())
    if (!alumnoId) {
      return NextResponse.json({ error: 'alumnoId requerido' }, { status: 400 })
    }
    const captura = await obtenerCaptura({ alumnoId, bimestre, ciclo })
    return jsonOk(captura)
  } catch (e) {
    return jsonError(e)
  }
}

export async function PUT(req: Request) {
  try {
    await requireBoletasSession(req)
    const body = (await req.json()) as {
      alumnoId?: number
      bimestre?: number
      ciclo?: number
      valores?: Record<number | string, string>
    }
    const alumnoId = Number(body.alumnoId)
    const bimestre = Number(body.bimestre ?? 1)
    const ciclo = Number(body.ciclo ?? cicloEscolarActualBoletas())
    if (!alumnoId || !body.valores || typeof body.valores !== 'object') {
      return NextResponse.json({ error: 'alumnoId y valores requeridos' }, { status: 400 })
    }
    const valores: Record<number, string> = {}
    for (const [k, v] of Object.entries(body.valores)) {
      valores[Number(k)] = String(v ?? '')
    }
    const result = await guardarCaptura({ alumnoId, bimestre, ciclo, valores })
    return jsonOk({ ok: true, ...result })
  } catch (e) {
    return jsonError(e)
  }
}
