import { NextResponse } from 'next/server'
import type { CatalogoMaestrosTab } from '@/lib/catalogoMaestrosConstants'
import {
  eliminarMateriaCatalogo,
  listarMateriasCatalogo,
  upsertMateriaCatalogo,
} from '@/lib/catalogoMaestrosService'

export const runtime = 'nodejs'

function parseTab(v: string | null): CatalogoMaestrosTab {
  if (v === 'maternal-kinder' || v === 'primaria' || v === 'secundaria') return v
  return 'secundaria'
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const tab = parseTab(url.searchParams.get('tab'))
    const grado = Number(url.searchParams.get('grado'))
    const materias = await listarMateriasCatalogo({
      tab,
      grado: Number.isFinite(grado) && grado > 0 ? grado : undefined,
    })
    return NextResponse.json({ ok: true, materias })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al listar materias'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const row = await upsertMateriaCatalogo(body)
    return NextResponse.json({ ok: true, materia: row })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al guardar materia'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get('id'))
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    }
    await eliminarMateriaCatalogo(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al eliminar materia'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
