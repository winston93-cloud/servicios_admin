import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { registrarClaveAlumnoPortal } from '@/lib/portalClaveAlumnoService'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const alumnoRef = String(body.alumnoRef ?? body.username ?? '').trim()
    const claveNueva = String(body.claveNueva ?? body.password ?? '')
    const claveConfirmacion = String(body.claveConfirmacion ?? body.confirmPassword ?? '')

    if (!alumnoRef || !claveNueva || !claveConfirmacion) {
      return NextResponse.json(
        { error: 'Número de control, clave nueva y confirmación son obligatorios.' },
        { status: 400 }
      )
    }

    const db = createDbAdmin()
    const resultado = await registrarClaveAlumnoPortal(
      db,
      alumnoRef,
      claveNueva,
      claveConfirmacion
    )

    if (!resultado.ok) {
      return NextResponse.json(
        { ok: false, error: resultado.mensaje, codigo: resultado.codigo },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true, mensaje: resultado.mensaje })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo registrar la clave'
    console.error('POST /api/auth/registrar-clave:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
