import { NextResponse } from 'next/server'
import type { CatalogoMaestrosTab } from '@/lib/catalogoMaestrosConstants'
import {
  eliminarMaestroCatalogo,
  listarMaestrosCatalogo,
  upsertMaestroCatalogo,
} from '@/lib/catalogoMaestrosService'

export const runtime = 'nodejs'

function parseTab(v: string | null): CatalogoMaestrosTab {
  if (v === 'maternal-kinder' || v === 'primaria' || v === 'secundaria') return v
  return 'secundaria'
}

export async function GET(request: Request) {
  try {
    const tab = parseTab(new URL(request.url).searchParams.get('tab'))
    return NextResponse.json({ ok: true, maestros: await listarMaestrosCatalogo({ tab }) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al listar maestros'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const tab = parseTab(body.tab ?? null)
    const row = await upsertMaestroCatalogo({ ...body, tab })
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
