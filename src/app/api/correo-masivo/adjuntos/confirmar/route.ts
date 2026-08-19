import { NextResponse } from 'next/server'
import { confirmarSubidaAdjuntoInsforge } from '@/lib/correoMasivoAdjuntosStorage'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      confirmUrl?: string
      size?: number
      contentType?: string
    }
    const confirmUrl = String(body.confirmUrl ?? '').trim()
    const size = Number(body.size)
    const contentType = String(body.contentType ?? 'application/octet-stream')

    if (!confirmUrl) {
      return NextResponse.json({ error: 'confirmUrl requerido' }, { status: 400 })
    }
    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: 'Tamaño inválido' }, { status: 400 })
    }

    await confirmarSubidaAdjuntoInsforge(confirmUrl, size, contentType)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al confirmar subida'
    console.error('correo-masivo/adjuntos/confirmar POST:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
