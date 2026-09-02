import { NextResponse } from 'next/server'
import { revisarInscripcionPorGrupo } from '@/lib/revisionPagadosGrupo'

export const runtime = 'nodejs'

/**
 * POST { grupo: "2a" | "7b" } — lista del grupo con inscripción completa/incompleta.
 * Público (entrada al colegio).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const grupo = String(body?.grupo ?? body?.consulta ?? '').trim()
    const result = await revisarInscripcionPorGrupo(grupo)
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
