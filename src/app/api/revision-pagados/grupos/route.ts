import { NextResponse } from 'next/server'
import { listarGruposDisponiblesEntrada } from '@/lib/revisionPagadosGrupo'

export const runtime = 'nodejs'

/** GET — catálogo de grupos activos (autocomplete entrada). Público. */
export async function GET() {
  try {
    const result = await listarGruposDisponiblesEntrada()
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al listar grupos'
    console.error('revision-pagados/grupos:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
