import { NextResponse } from 'next/server'
import { autorizarDocumentacionCompleta } from '@/lib/controlEscolarService'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      alumnoRef?: string
      autorizadoPor?: string
      documentacionCompleta?: boolean
    }

    const alumnoRef = String(body.alumnoRef ?? '').trim()
    const autorizadoPor = String(body.autorizadoPor ?? '').trim()
    const documentacionCompleta = Boolean(body.documentacionCompleta)

    if (!alumnoRef) {
      return NextResponse.json(
        { ok: false, message: 'No se proporcionó la referencia del alumno' },
        { status: 400 }
      )
    }

    if (!autorizadoPor) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Falta identificar al usuario de sesión que autoriza',
        },
        { status: 400 }
      )
    }

    const result = await autorizarDocumentacionCompleta({
      alumnoRef,
      autorizadoPor,
      documentacionCompleta,
    })
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error en el sistema'
    console.error('API control-escolar:', e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
