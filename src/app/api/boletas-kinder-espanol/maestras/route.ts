import { NextResponse } from 'next/server'
import { requireAdmin, requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import {
  asignarGrupoDocenteKinder,
  eliminarDocenteKinder,
  guardarDocenteKinder,
  listarDocentesKinder,
} from '@/lib/boletasKinderEnTeachers'

export const dynamic = 'force-dynamic'

const listar = async () => jsonOk({ teachers: await listarDocentesKinder('es') })

/** Catálogo de maestras de español de Kinder y sus grupos. */
export async function GET(req: Request) {
  try {
    requireAdmin(await requireBoletasSession(req))
    return await listar()
  } catch (e) {
    return jsonError(e)
  }
}

export async function POST(req: Request) {
  try {
    requireAdmin(await requireBoletasSession(req))
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    if (body.accion === 'guardar') {
      await guardarDocenteKinder('es', body)
    } else if (body.accion === 'asignar') {
      await asignarGrupoDocenteKinder('es', { grado: body.grado, grupo: body.grupo, maestroId: body.maestroId })
    } else {
      return NextResponse.json({ error: 'accion inválida' }, { status: 400 })
    }
    return await listar()
  } catch (e) {
    return jsonError(e, 400)
  }
}

export async function DELETE(req: Request) {
  try {
    requireAdmin(await requireBoletasSession(req))
    await eliminarDocenteKinder('es', new URL(req.url).searchParams.get('id'))
    return await listar()
  } catch (e) {
    return jsonError(e, 400)
  }
}
