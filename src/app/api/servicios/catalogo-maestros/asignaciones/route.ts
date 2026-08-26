import { NextResponse } from 'next/server'
import type { CatalogoMaestrosTab } from '@/lib/catalogoMaestrosConstants'
import {
  asignarMaestroGradoGrupo,
  eliminarAsignacionCatalogo,
  listarAsignacionesCatalogo,
  upsertAsignacionCatalogo,
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
    const asignaciones = await listarAsignacionesCatalogo({
      tab,
      grado: Number.isFinite(grado) && grado > 0 ? grado : undefined,
    })
    return NextResponse.json({ ok: true, asignaciones })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al listar asignaciones'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>

    if (body.modo === 'grado-grupo') {
      const row = await asignarMaestroGradoGrupo({
        nivel: Number(body.nivel),
        grado: Number(body.grado),
        grupo_letra: String(body.grupo_letra ?? 'A'),
        idioma: body.idioma === 'en' ? 'en' : 'es',
        maestro_id: Number(body.maestro_id),
      })
      return NextResponse.json({ ok: true, asignacion: row })
    }

    const row = await upsertAsignacionCatalogo({
      grupo_id: body.grupo_id != null ? Number(body.grupo_id) : undefined,
      maestro_id: Number(body.maestro_id),
      materia_id: Number(body.materia_id),
      grupo_letra: String(body.grupo_letra ?? 'A'),
    })
    return NextResponse.json({ ok: true, asignacion: row })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al guardar asignación'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get('id'))
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    }
    await eliminarAsignacionCatalogo(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al eliminar asignación'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
