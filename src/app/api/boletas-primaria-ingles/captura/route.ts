import { NextResponse } from 'next/server'
import { requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { cicloEscolarActualBoletas } from '@/lib/boletasCiclo'
import { guardarCaptura, obtenerCaptura } from '@/lib/boletasPrimariaEnService'

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

function toNumMap(raw: unknown): Record<number, string> {
  const out: Record<number, string> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    out[Number(k)] = String(v ?? '')
  }
  return out
}

export async function PUT(req: Request) {
  try {
    await requireBoletasSession(req)
    const body = (await req.json()) as {
      alumnoId?: number
      bimestre?: number
      ciclo?: number
      subjects?: Record<number | string, string>
      skills?: Record<number | string, string>
      attendance?: { school_days?: string; days_absent?: string }
    }
    const alumnoId = Number(body.alumnoId)
    const bimestre = Number(body.bimestre ?? 1)
    const ciclo = Number(body.ciclo ?? cicloEscolarActualBoletas())
    if (!alumnoId) {
      return NextResponse.json({ error: 'alumnoId requerido' }, { status: 400 })
    }
    const result = await guardarCaptura({
      alumnoId,
      bimestre,
      ciclo,
      subjects: toNumMap(body.subjects),
      skills: toNumMap(body.skills),
      attendance: body.attendance,
    })
    return jsonOk({ ok: true, ...result })
  } catch (e) {
    return jsonError(e)
  }
}
