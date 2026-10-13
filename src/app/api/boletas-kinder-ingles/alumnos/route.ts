import { NextResponse } from 'next/server'
import { requireAdmin, requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { cicloEscolarActualBoletas } from '@/lib/boletasCiclo'
import { listarAlumnos, progresoAlumnos } from '@/lib/boletasKinderEnService'
import type { KinderEnGrado } from '@/lib/boletasKinderEnCatalog'

export async function GET(req: Request) {
  try {
    requireAdmin(await requireBoletasSession(req))
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
    const bimestre = Number(url.searchParams.get('bimestre') ?? 0)
    const lista = await listarAlumnos({ grado, grupoLetra: grupo, ciclo })
    const progreso =
      bimestre >= 1 && bimestre <= 3
        ? await progresoAlumnos(lista.map((a) => a.alumno_id), grado as KinderEnGrado, bimestre, ciclo)
        : null
    const alumnos = lista.map((a) => ({ ...a, progreso: progreso?.get(a.alumno_id) ?? null }))
    return jsonOk({ alumnos, grado, grupo, ciclo })
  } catch (e) {
    return jsonError(e)
  }
}
