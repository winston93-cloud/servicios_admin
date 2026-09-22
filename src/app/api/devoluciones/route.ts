import { NextResponse } from 'next/server'
import { guardarDevolucion, listarDevoluciones } from '@/lib/devolucionesService'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const rows = await listarDevoluciones(60)
    return NextResponse.json({ ok: true, rows })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al listar'
    console.error('API devoluciones GET:', e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      asunto?: string
      realizadoPor?: string
      usuarioId?: number
      imagenBase64?: string
      mimeType?: string
    }

    const result = await guardarDevolucion({
      asunto: String(body.asunto ?? ''),
      realizadoPor: String(body.realizadoPor ?? ''),
      usuarioId: body.usuarioId,
      imagenBase64: String(body.imagenBase64 ?? ''),
      mimeType: String(body.mimeType ?? 'image/png'),
    })

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error en el sistema'
    console.error('API devoluciones POST:', e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
