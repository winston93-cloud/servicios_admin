import { NextResponse } from 'next/server'
import {
  consultarCupoInscripcion,
  nivelGradoDesdeGradeLevelAgenda,
} from '@/lib/cupoInscripcionPrimaria'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Consulta pública de cupo (AgendaW / portal).
 * Query: ?nivel=3&grado=3  ó  ?level=primaria&grade_level=primaria_3
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    let nivel = Number(searchParams.get('nivel'))
    let grado = Number(searchParams.get('grado'))

    if (!(nivel > 0 && grado > 0)) {
      const level = searchParams.get('level') || searchParams.get('nivelAgenda') || ''
      const gradeLevel =
        searchParams.get('grade_level') || searchParams.get('gradeLevel') || ''
      const mapped = nivelGradoDesdeGradeLevelAgenda(level, gradeLevel)
      if (!mapped) {
        return NextResponse.json(
          {
            error:
              'Indica nivel y grado (ej. nivel=3&grado=3) o level/grade_level de AgendaW.',
          },
          { status: 400 }
        )
      }
      nivel = mapped.nivel
      grado = mapped.grado
    }

    const cicloParam = searchParams.get('ciclo')
    const cicloInscripcion =
      cicloParam != null && Number.isFinite(Number(cicloParam)) && Number(cicloParam) > 0
        ? Number(cicloParam)
        : undefined

    const consulta = await consultarCupoInscripcion(nivel, grado, cicloInscripcion)
    return NextResponse.json({
      ok: true,
      ...consulta,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al consultar cupo'
    console.error('cupo-inscripcion:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
