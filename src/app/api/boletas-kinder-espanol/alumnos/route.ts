import { NextResponse } from 'next/server'
import { requireAdmin, requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { cicloEscolarActualBoletas } from '@/lib/boletasCiclo'
import { listarAlumnos, progresoAlumnos } from '@/lib/boletasKinderEsService'
import { esGradoKinderEs } from '@/lib/boletasKinderEsCatalog'

export async function GET(req: Request) {
  try {
    requireAdmin(await requireBoletasSession(req))
    const url = new URL(req.url)
    const grado = Number(url.searchParams.get('grado'))
    const grupo = String(url.searchParams.get('grupo') ?? '')
    const ciclo = Number(url.searchParams.get('ciclo') ?? cicloEscolarActualBoletas())
    if (!esGradoKinderEs(grado) || !grupo) {
      return NextResponse.json({ error: 'grado (1–3) y grupo requeridos' }, { status: 400 })
    }
    const bimestre = Number(url.searchParams.get('bimestre') ?? 0)
    const lista = await listarAlumnos({ grado, grupoLetra: grupo, ciclo })
    const progreso =
      bimestre >= 1 && bimestre <= 3
        ? await progresoAlumnos(lista.map((a) => a.alumno_id), grado, bimestre, ciclo)
        : null
    const alumnos = lista.map((a) => ({ ...a, progreso: progreso?.get(a.alumno_id) ?? null }))
    return jsonOk({ alumnos, grado, grupo, ciclo })
  } catch (e) {
    return jsonError(e)
  }
}
