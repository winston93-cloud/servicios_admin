import { NextResponse } from 'next/server'
import {
  revisarInscripcionPorNivelEntrada,
  type NivelEntradaClave,
} from '@/lib/revisionPagadosGrupo'

export const runtime = 'nodejs'

/**
 * POST { nivel: "maternal_kinder" | "primaria" | "secundaria" }
 * Público — consulta operativa para "Revisión pagados/no pagados".
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const rawNivel = String(body?.nivel ?? '').trim() as NivelEntradaClave

    const nivel: NivelEntradaClave | null =
      rawNivel === 'maternal_kinder' ||
      rawNivel === 'primaria' ||
      rawNivel === 'secundaria'
        ? rawNivel
        : null

    if (!nivel) {
      return NextResponse.json(
        { error: 'nivel inválido.' },
        { status: 400 }
      )
    }

    const result = await revisarInscripcionPorNivelEntrada(nivel)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(result)
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Error al revisar pendientes por nivel'
    console.error('revision-pagados/pendientes-nivel:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

