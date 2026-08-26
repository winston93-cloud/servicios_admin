import { NextResponse } from 'next/server'
import { cfgDesdeRequestSlug, jsonRacNivelError, requireRacNivelSession } from '@/lib/rac/racAuthNivel'
import { getServiceForSlug } from '@/lib/rac/racServiceNivel'

type Params = { params: Promise<{ slug: string }> }

export async function GET(req: Request, { params }: Params) {
  try {
    const { slug } = await params
    const cfg = cfgDesdeRequestSlug(slug)
    await requireRacNivelSession(cfg, req)
    const svc = getServiceForSlug(slug)
    const url = new URL(req.url)
    const materiaId = Number(url.searchParams.get('materiaId'))
    const grupo = String(url.searchParams.get('grupo') ?? 'A')
    const tipo = Number(url.searchParams.get('tipo') ?? 1)
    if (!materiaId) return NextResponse.json({ error: 'materiaId requerido' }, { status: 400 })
    const data = await svc.listarGrupoCaptura({ materiaId, grupoLetra: grupo, tipo })
    return NextResponse.json(data)
  } catch (e) {
    const { error, status } = jsonRacNivelError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { slug } = await params
    const cfg = cfgDesdeRequestSlug(slug)
    const session = await requireRacNivelSession(cfg, req)
    const svc = getServiceForSlug(slug)
    const body = (await req.json()) as {
      accion?: string
      alumnoId?: number
      materiaId?: number
      tipo?: number
      motivo?: number
      mensaje?: string
      fecha?: string
      hora?: string
    }
    const accion = body.accion ?? 'reporte'
    if (accion === 'informe') {
      const data = await svc.capturarInforme({
        session,
        alumnoId: Number(body.alumnoId),
        materiaId: Number(body.materiaId ?? 0),
        mensaje: String(body.mensaje ?? ''),
      })
      return NextResponse.json({ ok: true, ...data })
    }
    if (accion === 'cita') {
      const data = await svc.capturarCita({
        session,
        alumnoId: Number(body.alumnoId),
        materiaId: Number(body.materiaId ?? 0),
        tipo: Number(body.tipo ?? 1),
        mensaje: String(body.mensaje ?? ''),
        fecha: String(body.fecha ?? ''),
        hora: String(body.hora ?? '09:00'),
      })
      return NextResponse.json({ ok: true, ...data })
    }
    const data = await svc.capturarReporte({
      session,
      alumnoId: Number(body.alumnoId),
      materiaId: Number(body.materiaId ?? 0),
      tipo: Number(body.tipo ?? 1),
      motivo: Number(body.motivo ?? 1),
      mensaje: String(body.mensaje ?? ''),
    })
    return NextResponse.json({ ok: true, ...data })
  } catch (e) {
    const { error, status } = jsonRacNivelError(e)
    return NextResponse.json({ error }, { status })
  }
}
