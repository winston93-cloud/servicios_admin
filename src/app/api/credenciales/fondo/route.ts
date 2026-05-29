import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  guardarFondoCustom,
  leerFondoCustomBuffer,
  leerFondoDefaultBuffer,
} from '@/lib/credencialesFondos'
import { NIVELES_CREDENCIAL } from '@/lib/credencialesConfig'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const nivel = Number(url.searchParams.get('nivel'))
  if (!nivel || nivel < 1 || nivel > 4) {
    return NextResponse.json({ error: 'nivel 1-4 requerido' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const custom = await leerFondoCustomBuffer(supabase, nivel)
  const buf = custom ?? leerFondoDefaultBuffer(nivel)
  if (!buf) {
    return NextResponse.json({ error: 'Sin imagen de fondo' }, { status: 404 })
  }

  const ct = buf[0] === 0xff && buf[1] === 0xd8 ? 'image/jpeg' : 'image/png'
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': ct,
      'Cache-Control': 'no-store',
    },
  })
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const nivel = Number(form.get('nivel'))
    const file = form.get('archivo')

    if (!nivel || nivel < 1 || nivel > 4) {
      return NextResponse.json({ error: 'nivel 1-4 requerido' }, { status: 400 })
    }
    if (!(file instanceof File) || !file.size) {
      return NextResponse.json({ error: 'archivo de imagen requerido' }, { status: 400 })
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Solo imágenes PNG o JPG' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Máximo 5 MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const supabase = createSupabaseAdmin()
    const res = await guardarFondoCustom(supabase, nivel, buffer, file.type)

    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 500 })
    }

    const meta = NIVELES_CREDENCIAL.find((n) => n.nivel === nivel)
    return NextResponse.json({
      ok: true,
      nivel,
      etiqueta: meta?.etiqueta,
      via: res.via,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al subir fondo'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
