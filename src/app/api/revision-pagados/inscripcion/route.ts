import { NextResponse } from 'next/server'
import { revisarInscripcionAlumno } from '@/lib/revisionPagadosInscripcion'

export const runtime = 'nodejs'

/**
 * POST { alumnoId } — estado de inscripción para revisión en entrada.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const alumnoId = Number(body?.alumnoId)
    const result = await revisarInscripcionAlumno(alumnoId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Error al revisar inscripción del alumno'
    console.error('revision-pagados/inscripcion:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
