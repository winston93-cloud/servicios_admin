import { NextResponse } from 'next/server'
import { requireAdmin, requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import {
  esModuloBoleta,
  listarPublicaciones,
  publicarTrimestre,
  retirarTrimestre,
  trimestreValido,
} from '@/lib/boletasPortal'

export const dynamic = 'force-dynamic'

/** Trimestres publicados a papás de un módulo (personal de boletas). */
export async function GET(req: Request) {
  try {
    await requireBoletasSession(req)
    const url = new URL(req.url)
    const modulo = url.searchParams.get('modulo')
    const ciclo = Number(url.searchParams.get('ciclo'))
    if (!esModuloBoleta(modulo)) {
      return NextResponse.json({ error: 'modulo inválido' }, { status: 400 })
    }
    if (!Number.isInteger(ciclo) || ciclo <= 0) {
      return NextResponse.json({ error: 'ciclo inválido' }, { status: 400 })
    }
    return jsonOk({ publicaciones: await listarPublicaciones(ciclo, [modulo]) })
  } catch (e) {
    return jsonError(e)
  }
}

/** Publica o retira un trimestre del portal de papás (solo dirección/coordinación). */
export async function POST(req: Request) {
  try {
    const session = await requireBoletasSession(req)
    requireAdmin(session)
    const body = (await req.json().catch(() => ({}))) as {
      modulo?: unknown
      ciclo?: unknown
      trimestre?: unknown
      accion?: unknown
    }
    const modulo = body.modulo
    const ciclo = Number(body.ciclo)
    const trimestre = trimestreValido(body.trimestre)
    if (!esModuloBoleta(modulo)) {
      return NextResponse.json({ error: 'modulo inválido' }, { status: 400 })
    }
    if (!Number.isInteger(ciclo) || ciclo <= 0) {
      return NextResponse.json({ error: 'ciclo inválido' }, { status: 400 })
    }
    if (trimestre == null) {
      return NextResponse.json({ error: 'trimestre inválido (1 a 3)' }, { status: 400 })
    }
    if (body.accion === 'publicar') {
      await publicarTrimestre({ ciclo, modulo, trimestre, por: session.nombre || session.usuario })
    } else if (body.accion === 'retirar') {
      await retirarTrimestre({ ciclo, modulo, trimestre })
    } else {
      return NextResponse.json({ error: 'accion inválida' }, { status: 400 })
    }
    return jsonOk({ publicaciones: await listarPublicaciones(ciclo, [modulo]) })
  } catch (e) {
    return jsonError(e)
  }
}
