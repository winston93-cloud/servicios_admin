import { NextResponse } from 'next/server'
import { requireAdmin, requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import {
  asignarGrupoKinderEn,
  eliminarTeacherKinderEn,
  guardarTeacherKinderEn,
  listarTeachersKinderEn,
} from '@/lib/boletasKinderEnTeachers'

export const dynamic = 'force-dynamic'

/** Catálogo de teachers de inglés de Maternal/Kinder y sus grupos. */
export async function GET(req: Request) {
  try {
    requireAdmin(await requireBoletasSession(req))
    return jsonOk({ teachers: await listarTeachersKinderEn() })
  } catch (e) {
    return jsonError(e)
  }
}

export async function POST(req: Request) {
  try {
    requireAdmin(await requireBoletasSession(req))
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    if (body.accion === 'guardar') {
      await guardarTeacherKinderEn(body)
    } else if (body.accion === 'asignar') {
      await asignarGrupoKinderEn({ grado: body.grado, grupo: body.grupo, maestroId: body.maestroId })
    } else {
      return NextResponse.json({ error: 'accion inválida' }, { status: 400 })
    }
    return jsonOk({ teachers: await listarTeachersKinderEn() })
  } catch (e) {
    return jsonError(e, 400)
  }
}

export async function DELETE(req: Request) {
  try {
    requireAdmin(await requireBoletasSession(req))
    await eliminarTeacherKinderEn(new URL(req.url).searchParams.get('id'))
    return jsonOk({ teachers: await listarTeachersKinderEn() })
  } catch (e) {
    return jsonError(e, 400)
  }
}
