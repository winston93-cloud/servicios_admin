import { NextResponse } from 'next/server'
import { jsonRacError, requireRacSession } from '@/lib/racAuth'
import { capturarCita, capturarInforme, capturarReporte, listarGrupoCaptura } from '@/lib/racService'

export async function GET(req: Request) {
  try {
    await requireRacSession(req)
    const url = new URL(req.url)
    const materiaId = Number(url.searchParams.get('materiaId') ?? 0)
    const grado = Number(url.searchParams.get('grado') ?? 0)
    const grupo = String(url.searchParams.get('grupo') ?? 'A')
    const tipo = Number(url.searchParams.get('tipo') ?? 1)
    if (!materiaId && !grado) {
      return NextResponse.json({ error: 'materiaId o grado requerido' }, { status: 400 })
    }
    const data = await listarGrupoCaptura({
      materiaId: materiaId || undefined,
      grado: grado || undefined,
      grupoLetra: grupo,
      tipo,
    })
    return NextResponse.json(data)
  } catch (e) {
    const { error, status } = jsonRacError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRacSession(req)
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
      const data = await capturarInforme({
        session,
        alumnoId: Number(body.alumnoId),
        materiaId: Number(body.materiaId ?? 0),
        mensaje: String(body.mensaje ?? ''),
      })
      return NextResponse.json({ ok: true, ...data })
    }
    if (accion === 'cita') {
      const data = await capturarCita({
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
    const data = await capturarReporte({
      session,
      alumnoId: Number(body.alumnoId),
      materiaId: Number(body.materiaId ?? 0),
      tipo: Number(body.tipo ?? 1),
      motivo: Number(body.motivo ?? 1),
      mensaje: String(body.mensaje ?? ''),
    })
    return NextResponse.json({ ok: true, ...data })
  } catch (e) {
    const { error, status } = jsonRacError(e)
    return NextResponse.json({ error }, { status })
  }
}
