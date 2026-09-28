import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import {
  TalleresError,
  eliminarAsignacion,
  eliminarCatalogo,
  guardarAsignacion,
  guardarMaestro,
  guardarTaller,
  snapshotTalleres,
} from '@/lib/talleres/talleresService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Recurso = 'taller' | 'maestro' | 'asignacion'

function parseRecurso(raw: unknown): Recurso | null {
  return raw === 'taller' || raw === 'maestro' || raw === 'asignacion' ? raw : null
}

function responderError(e: unknown, contexto: string) {
  if (e instanceof TalleresError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error(contexto, e)
  const message = e instanceof Error ? e.message : 'Error inesperado'
  return NextResponse.json({ error: message }, { status: 500 })
}

export async function GET(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  try {
    return NextResponse.json(await snapshotTalleres())
  } catch (e) {
    return responderError(e, 'GET /api/talleres:')
  }
}

/** Crear o actualizar (con `id`) un taller, maestro o asignación. */
export async function POST(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json()) as Record<string, unknown>
    const recurso = parseRecurso(body.recurso)
    if (!recurso) return NextResponse.json({ error: 'Recurso inválido.' }, { status: 400 })
    if (recurso === 'taller') await guardarTaller(body)
    else if (recurso === 'maestro') await guardarMaestro(body)
    else await guardarAsignacion(body)
    return NextResponse.json(await snapshotTalleres())
  } catch (e) {
    return responderError(e, 'POST /api/talleres:')
  }
}

export async function DELETE(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  try {
    const url = new URL(request.url)
    const recurso = parseRecurso(url.searchParams.get('recurso'))
    const id = Number(url.searchParams.get('id'))
    if (!recurso || !(id > 0)) {
      return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 })
    }
    let modo: 'eliminado' | 'desactivado' = 'eliminado'
    if (recurso === 'asignacion') await eliminarAsignacion(id)
    else modo = (await eliminarCatalogo(recurso, id)).modo
    return NextResponse.json({ modo, ...(await snapshotTalleres()) })
  } catch (e) {
    return responderError(e, 'DELETE /api/talleres:')
  }
}
