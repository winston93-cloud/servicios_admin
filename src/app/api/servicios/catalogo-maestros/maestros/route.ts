import { NextResponse } from 'next/server'
import {
  eliminarMaestroCatalogo,
  listarMaestrosCatalogo,
  upsertMaestroCatalogo,
} from '@/lib/catalogoMaestrosService'

export const runtime = 'nodejs'

export async function GET() {
  try {
    return NextResponse.json({ ok: true, maestros: await listarMaestrosCatalogo() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al listar maestros'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const row = await upsertMaestroCatalogo(body)
    return NextResponse.json({ ok: true, maestro: row })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al guardar maestro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get('id'))
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    }
    await eliminarMaestroCatalogo(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al eliminar maestro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
