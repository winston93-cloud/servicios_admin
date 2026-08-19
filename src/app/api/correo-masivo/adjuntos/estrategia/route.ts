import { NextResponse } from 'next/server'
import {
  CORREO_MASIVO_MAX_ARCHIVO_GRANDE_BYTES,
  CORREO_MASIVO_MAX_TOTAL_BYTES,
  esTokenAdjuntosValido,
  listarAdjuntosTemporales,
  obtenerEstrategiaSubidaAdjunto,
} from '@/lib/correoMasivoAdjuntosStorage'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string
      filename?: string
      size?: number
      contentType?: string
    }
    const tokenRaw = String(body.token ?? '').trim()
    const filename = String(body.filename ?? '').trim()
    const size = Number(body.size)
    const contentType = String(body.contentType ?? 'application/octet-stream')

    if (!filename) {
      return NextResponse.json({ error: 'Nombre de archivo requerido' }, { status: 400 })
    }
    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: 'Tamaño de archivo inválido' }, { status: 400 })
    }
    if (size > CORREO_MASIVO_MAX_ARCHIVO_GRANDE_BYTES) {
      return NextResponse.json(
        {
          error: `«${filename}» supera ~${(CORREO_MASIVO_MAX_ARCHIVO_GRANDE_BYTES / (1024 * 1024)).toFixed(0)} MB por archivo.`,
        },
        { status: 400 }
      )
    }

    const token = esTokenAdjuntosValido(tokenRaw) ? tokenRaw : ''
    const existentes = token ? await listarAdjuntosTemporales(token) : []
    const pesoPrevio = existentes.reduce((s, a) => s + a.size, 0)
    if (pesoPrevio + size > CORREO_MASIVO_MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { error: 'El total de adjuntos supera el límite de Gmail (~24 MB).' },
        { status: 400 }
      )
    }

    const prep = await obtenerEstrategiaSubidaAdjunto(token, filename, size, contentType)
    return NextResponse.json({
      ok: true,
      token: prep.token,
      key: prep.key,
      strategy: prep.strategy,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al preparar subida'
    console.error('correo-masivo/adjuntos/estrategia POST:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
