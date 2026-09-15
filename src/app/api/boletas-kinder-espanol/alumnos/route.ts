import { NextResponse } from 'next/server'
import { requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { cicloEscolarActualBoletas } from '@/lib/boletasCiclo'
import { listarAlumnos } from '@/lib/boletasKinderEsService'

export async function GET(req: Request) {
  try {
    await requireBoletasSession(req)
    const url = new URL(req.url)
    const grado = Number(url.searchParams.get('grado'))
    const grupo = String(url.searchParams.get('grupo') ?? '')
    const ciclo = Number(url.searchParams.get('ciclo') ?? cicloEscolarActualBoletas())
    if (!grado || !grupo) {
      return NextResponse.json({ error: 'grado y grupo requeridos' }, { status: 400 })
    }
    const alumnos = await listarAlumnos({ grado, grupoLetra: grupo, ciclo })
    return jsonOk({ alumnos, grado, grupo, ciclo })
  } catch (e) {
    return jsonError(e)
  }
}
