import { NextResponse } from 'next/server'
import { revisarInscripcionPorGrupo } from '@/lib/revisionPagadosGrupo'

export const runtime = 'nodejs'

/**
 * POST { grupo: "K2A" | "2a" | "7b", nivel?: number }
 * Público (entrada al colegio).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const grupo = String(body?.grupo ?? body?.consulta ?? '').trim()
    const nivelRaw = Number(body?.nivel)
    const nivel =
      Number.isFinite(nivelRaw) && nivelRaw > 0 ? nivelRaw : null
    const result = await revisarInscripcionPorGrupo(grupo, nivel)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al revisar el grupo'
    console.error('revision-pagados/grupo:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
