import { NextResponse } from 'next/server'
import { requireAdmin, requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { devolverEntrega } from '@/lib/boletasEntrega'
import { publicarTrimestre, retirarTrimestre, trimestreValido } from '@/lib/boletasPortal'
import { tableroKinderEn } from '@/lib/boletasKinderEnTablero'
import { esGradoKinderEn, grupoNumeroDesdeLetra } from '@/lib/boletasKinderEnCatalog'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function periodo(cicloRaw: unknown, trimestreRaw: unknown) {
  const ciclo = Number(cicloRaw)
  const trimestre = trimestreValido(trimestreRaw)
  if (!Number.isInteger(ciclo) || ciclo <= 0) throw new Error('ciclo inválido')
  if (trimestre == null) throw new Error('trimestre inválido (1 a 3)')
  return { ciclo, trimestre }
}

/** Tablero de la directora: avance por grupo, entregas de las teachers y publicación a papás. */
export async function GET(req: Request) {
  try {
    requireAdmin(await requireBoletasSession(req))
    const url = new URL(req.url)
    const { ciclo, trimestre } = periodo(url.searchParams.get('ciclo'), url.searchParams.get('trimestre'))
    return jsonOk({ grupos: await tableroKinderEn(ciclo, trimestre) })
  } catch (e) {
    return jsonError(e, 400)
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireBoletasSession(req)
    requireAdmin(session)
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const { ciclo, trimestre } = periodo(body.ciclo, body.trimestre)
    const grado = Number(body.grado)
    const grupo = String(body.grupo ?? '').toUpperCase()
    if (!esGradoKinderEn(grado) || !grupoNumeroDesdeLetra(grupo)) {
      return NextResponse.json({ error: 'grado o grupo inválido' }, { status: 400 })
    }
    const quien = session.nombre || session.usuario
    const clave = { ciclo, modulo: 'kinder-en' as const, trimestre, grado, grupo }

    if (body.accion === 'devolver') {
      await devolverEntrega(clave, { nombre: quien, comentario: String(body.comentario ?? '') })
    } else if (body.accion === 'publicar' || body.accion === 'retirar') {
      if (grado === 0) {
        return NextResponse.json({ error: 'Maternal no tiene boleta en el portal de papás.' }, { status: 400 })
      }
      if (body.accion === 'publicar') {
        await publicarTrimestre({ ciclo, modulo: 'kinder-en', trimestre, grado, grupo, por: quien })
      } else {
        await retirarTrimestre({ ciclo, modulo: 'kinder-en', trimestre, grado, grupo })
      }
    } else {
      return NextResponse.json({ error: 'accion inválida' }, { status: 400 })
    }
    return jsonOk({ grupos: await tableroKinderEn(ciclo, trimestre) })
  } catch (e) {
    return jsonError(e, 400)
  }
}
