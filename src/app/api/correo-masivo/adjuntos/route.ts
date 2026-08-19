import { NextResponse } from 'next/server'
import {
  CORREO_MASIVO_MAX_ARCHIVO_DIRECTO_BYTES,
  CORREO_MASIVO_MAX_TOTAL_BYTES,
  esTokenAdjuntosValido,
  listarAdjuntosTemporales,
  subirAdjuntoTemporal,
} from '@/lib/correoMasivoAdjuntosStorage'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')?.trim() ?? ''
  if (!esTokenAdjuntosValido(token)) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
  }
  try {
    const archivos = await listarAdjuntosTemporales(token)
    const pesoTotal = archivos.reduce((s, a) => s + a.size, 0)
    return NextResponse.json({ ok: true, token, archivos, pesoTotal })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al listar adjuntos'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const tokenRaw = String(form.get('token') ?? '').trim()
    const token = esTokenAdjuntosValido(tokenRaw) ? tokenRaw : crypto.randomUUID()
    const file = form.get('archivo')
    if (!(file instanceof File) || !file.size) {
      return NextResponse.json({ error: 'Archivo vacío o inválido' }, { status: 400 })
    }
    if (file.size > CORREO_MASIVO_MAX_ARCHIVO_DIRECTO_BYTES) {
      return NextResponse.json(
        {
          error: `El archivo «${file.name}» pesa demasiado para una sola subida (${(file.size / (1024 * 1024)).toFixed(1)} MB). Comprímalo por debajo de ~3.5 MB.`,
        },
        { status: 400 }
      )
    }

    const existentes = tokenRaw ? await listarAdjuntosTemporales(token) : []
    const pesoPrevio = existentes.reduce((s, a) => s + a.size, 0)
    if (pesoPrevio + file.size > CORREO_MASIVO_MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { error: 'El total de adjuntos supera el límite de Gmail (~24 MB).' },
        { status: 400 }
      )
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const meta = await subirAdjuntoTemporal(token, file.name, buf, file.type || undefined)
    const archivos = await listarAdjuntosTemporales(token)
    const pesoTotal = archivos.reduce((s, a) => s + a.size, 0)

    return NextResponse.json({
      ok: true,
      token,
      archivo: meta,
      archivos,
      pesoTotal,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al subir adjunto'
    console.error('correo-masivo/adjuntos POST:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
