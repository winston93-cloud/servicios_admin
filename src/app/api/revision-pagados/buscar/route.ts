import { NextResponse } from 'next/server'
import { buscarAlumnosServicios } from '@/lib/alumnoBusquedaServicios'
import { getCicloEscolarActual } from '@/lib/ciclosEscolares'
import { obtenerCicloEscolarActual } from '@/lib/ciclosEscolaresService'

export const runtime = 'nodejs'

/**
 * Búsqueda pública para entrada al colegio (sin sesión).
 * POST { consulta, cicloEscolar?, cualquierCiclo? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const consulta = String(body?.consulta ?? '').trim()
    if (!consulta) {
      return NextResponse.json({ ok: true, resultados: [] })
    }

    const cicloActual = await obtenerCicloEscolarActual()
    const cicloDefault = cicloActual?.valor ?? getCicloEscolarActual()
    const cicloRaw = Number(body?.cicloEscolar)
    const cicloEscolar =
      Number.isFinite(cicloRaw) && cicloRaw > 0 ? cicloRaw : cicloDefault
    const cualquierCiclo = Boolean(body?.cualquierCiclo)

    const resultados = await buscarAlumnosServicios(consulta, cicloEscolar, {
      cualquierCiclo,
    })

    return NextResponse.json({ ok: true, resultados })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al buscar alumnos'
    console.error('revision-pagados/buscar:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
