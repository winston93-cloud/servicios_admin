import { NextResponse } from 'next/server'
import { procesarBajaAdministrativa } from '@/lib/bajasAdministrativasService'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      alumnoRef?: string
      realizadoPor?: string
    }

    const alumnoRef = String(body.alumnoRef ?? '').trim()
    const realizadoPor = String(body.realizadoPor ?? '').trim()

    if (!alumnoRef) {
      return NextResponse.json(
        { ok: false, message: 'No se proporcionó la referencia del alumno' },
        { status: 400 }
      )
    }

    if (!realizadoPor) {
      return NextResponse.json(
        { ok: false, message: 'Falta identificar al usuario que realiza la baja' },
        { status: 400 }
      )
    }

    const result = await procesarBajaAdministrativa({ alumnoRef, realizadoPor })
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error en el sistema'
    console.error('API bajas-administrativas:', e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
