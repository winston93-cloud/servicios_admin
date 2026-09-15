import { NextResponse } from 'next/server'
import { requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { cicloEscolarActualBoletas } from '@/lib/boletasCiclo'
import { listarAlumnos } from '@/lib/boletasKinderEnService'

export async function GET(req: Request) {
  try {
    await requireBoletasSession(req)
    const url = new URL(req.url)
    const gradoRaw = url.searchParams.get('grado')
    const grado = Number(gradoRaw)
    const grupo = String(url.searchParams.get('grupo') ?? '')
    const ciclo = Number(url.searchParams.get('ciclo') ?? cicloEscolarActualBoletas())
    // Maternal = 0 es válido; no usar !grado
    if (gradoRaw == null || Number.isNaN(grado) || !grupo) {
      return NextResponse.json({ error: 'grado y grupo requeridos' }, { status: 400 })
    }
    if (grado < 0 || grado > 3) {
      return NextResponse.json({ error: 'grado inválido (0–3)' }, { status: 400 })
    }
    const alumnos = await listarAlumnos({ grado, grupoLetra: grupo, ciclo })
    return jsonOk({ alumnos, grado, grupo, ciclo })
  } catch (e) {
    return jsonError(e)
  }
}
