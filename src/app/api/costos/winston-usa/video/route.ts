import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { guardarVideoUsaCiclo, obtenerVideoUsaCiclo } from '@/lib/winstonUsaProgramPagos'
import {
  confirmarSubidaVideoUsa,
  eliminarVideoUsa,
  esKeyVideoUsaDelCiclo,
  keyDeUrlVideoUsa,
  prepararSubidaVideoUsa,
  urlPublicaVideoUsa,
} from '@/lib/winstonUsaVideoStorage'

export const runtime = 'nodejs'

type Body = {
  accion?: 'preparar' | 'confirmar'
  ciclo?: number
  filename?: string
  size?: number
  contentType?: string
  key?: string
  confirmUrl?: string
}

function cicloValido(v: unknown): number | null {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

async function reemplazarVideo(ciclo: number, nuevaUrl: string | null): Promise<void> {
  const db = createDbAdmin()
  const anterior = keyDeUrlVideoUsa(await obtenerVideoUsaCiclo(db, ciclo))
  await guardarVideoUsaCiclo(db, ciclo, nuevaUrl)
  if (anterior && anterior !== keyDeUrlVideoUsa(nuevaUrl)) await eliminarVideoUsa(anterior)
}

export async function POST(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json()) as Body
    const ciclo = cicloValido(body.ciclo)
    if (!ciclo) return NextResponse.json({ error: 'ciclo requerido' }, { status: 400 })

    if (body.accion === 'preparar') {
      const { key, strategy } = await prepararSubidaVideoUsa(
        ciclo,
        String(body.filename ?? ''),
        Number(body.size),
        String(body.contentType ?? '')
      )
      return NextResponse.json({ ok: true, key, strategy })
    }

    if (body.accion === 'confirmar') {
      const key = String(body.key ?? '')
      if (!esKeyVideoUsaDelCiclo(key, ciclo)) {
        return NextResponse.json({ error: 'Archivo inválido' }, { status: 400 })
      }
      if (body.confirmUrl) {
        await confirmarSubidaVideoUsa(body.confirmUrl, Number(body.size), String(body.contentType ?? ''))
      }
      const url = urlPublicaVideoUsa(key)
      await reemplazarVideo(ciclo, url)
      return NextResponse.json({ ok: true, video_url: url })
    }

    return NextResponse.json({ error: 'accion inválida' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al subir el video'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  try {
    const ciclo = cicloValido(new URL(request.url).searchParams.get('ciclo'))
    if (!ciclo) return NextResponse.json({ error: 'ciclo requerido' }, { status: 400 })
    await reemplazarVideo(ciclo, null)
    return NextResponse.json({ ok: true, video_url: null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al quitar el video'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
