import { NextResponse, after } from 'next/server'
import { leerCuerpo, requireAdminTalleres, responderErrorTalleres } from '@/lib/talleres/talleresApi'
import {
  actualizarCupoAsignacion,
  eliminarAsignacion,
  eliminarCatalogo,
  guardarAsignacion,
  guardarMaestro,
  guardarTaller,
  idEntero,
  snapshotTalleres,
} from '@/lib/talleres/talleresService'
import { avisarReloj } from '@/lib/talleres/talleresRelojSync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Recurso = 'taller' | 'maestro' | 'asignacion'

function parseRecurso(raw: unknown): Recurso | null {
  return raw === 'taller' || raw === 'maestro' || raw === 'asignacion' ? raw : null
}

export async function GET(request: Request) {
  const auth = await requireAdminTalleres(request)
  if (!auth.ok) return auth.response
  try {
    return NextResponse.json(await snapshotTalleres())
  } catch (e) {
    return responderErrorTalleres(e, 'GET /api/talleres:')
  }
}

/** Crear o actualizar (con `id`) un taller, maestro o asignación. */
export async function POST(request: Request) {
  const auth = await requireAdminTalleres(request)
  if (!auth.ok) return auth.response
  try {
    const body = await leerCuerpo(request)
    if (body.recurso === 'cupo') {
      await actualizarCupoAsignacion(body)
      after(() => avisarReloj())
      return NextResponse.json(await snapshotTalleres())
    }
    const recurso = parseRecurso(body.recurso)
    if (!recurso) return NextResponse.json({ error: 'Recurso inválido.' }, { status: 400 })
    if (recurso === 'taller') await guardarTaller(body)
    else if (recurso === 'maestro') await guardarMaestro(body)
    else await guardarAsignacion(body)
    // 2026-10-05 — Maestros (número de empleado) y grupos alimentan el catálogo del reloj checador.
    if (recurso !== 'taller' || body.id) after(() => avisarReloj())
    return NextResponse.json(await snapshotTalleres())
  } catch (e) {
    return responderErrorTalleres(e, 'POST /api/talleres:')
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdminTalleres(request)
  if (!auth.ok) return auth.response
  try {
    const url = new URL(request.url)
    const recurso = parseRecurso(url.searchParams.get('recurso'))
    const id = idEntero(url.searchParams.get('id'))
    if (!recurso || !id) {
      return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 })
    }
    const { modo } = recurso === 'asignacion' ? await eliminarAsignacion(id) : await eliminarCatalogo(recurso, id)
    after(() => avisarReloj())
    return NextResponse.json({ modo, ...(await snapshotTalleres()) })
  } catch (e) {
    return responderErrorTalleres(e, 'DELETE /api/talleres:')
  }
}
