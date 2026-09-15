import { NextResponse } from 'next/server'
import { requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { cicloEscolarActualBoletas } from '@/lib/boletasCiclo'
import {
  enviarBoletaIndividual,
  type BoletasModuloEmail,
} from '@/lib/boletasEmailNivel'

const MODULOS: BoletasModuloEmail[] = [
  'kinder-es',
  'kinder-en',
  'primaria-es',
  'primaria-en',
  'secundaria',
]

export async function POST(req: Request) {
  try {
    await requireBoletasSession(req)
    const body = (await req.json()) as {
      modulo?: string
      alumnoId?: number
      bimestre?: number
      ciclo?: number
      dryRun?: boolean
    }
    const modulo = body.modulo as BoletasModuloEmail
    if (!MODULOS.includes(modulo)) {
      return NextResponse.json({ error: 'modulo inválido' }, { status: 400 })
    }
    const alumnoId = Number(body.alumnoId)
    const bimestre = Number(body.bimestre ?? 1)
    const ciclo = Number(body.ciclo ?? cicloEscolarActualBoletas())
    if (!alumnoId) {
      return NextResponse.json({ error: 'alumnoId requerido' }, { status: 400 })
    }
    const result = await enviarBoletaIndividual({
      modulo,
      alumnoId,
      bimestre,
      ciclo,
      dryRun: Boolean(body.dryRun),
    })
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }
    return jsonOk(result)
  } catch (e) {
    return jsonError(e)
  }
}
