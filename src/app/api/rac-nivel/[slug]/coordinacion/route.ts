import { NextResponse } from 'next/server'
import { cfgDesdeRequestSlug, jsonRacNivelError, requireRacNivelSession } from '@/lib/rac/racAuthNivel'
import { puedeAccionCoordNivel, puedeVerVistaCoordNivel } from '@/lib/rac/racPermisosNivel'
import { getServiceForSlug } from '@/lib/rac/racServiceNivel'

type Params = { params: Promise<{ slug: string }> }

export async function GET(req: Request, { params }: Params) {
  try {
    const { slug } = await params
    const cfg = cfgDesdeRequestSlug(slug)
    const session = await requireRacNivelSession(cfg, req)
    const svc = getServiceForSlug(slug)
    const url = new URL(req.url)
    const vista = url.searchParams.get('vista') ?? 'pendientes'
    if (!puedeVerVistaCoordNivel(session.role, vista)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (vista === 'citas') return NextResponse.json({ filas: await svc.inboxCitas(session) })
    if (vista === 'suspensiones') return NextResponse.json({ filas: await svc.inboxSuspensiones() })
    if (vista === 'historial') {
      const h = await svc.historialAlumno(String(url.searchParams.get('q') ?? ''))
      return NextResponse.json({ filas: h.reportes, alumnos: h.alumnos })
    }
    const filtro = vista === 'informes' || vista === 'todos' ? vista : 'pendientes'
    return NextResponse.json({ filas: await svc.inboxReportes(session, filtro) })
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
      entidad?: string
      id?: number
      accion?: string
      fecha?: string
    }
    const entidad = body.entidad === 'cita' ? 'cita' : body.entidad === 'suspension' ? 'suspension' : 'reporte'
    const accion = String(body.accion ?? '')
    if (!puedeAccionCoordNivel(session.role, entidad, accion)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    const id = Number(body.id)
    if (body.entidad === 'cita') {
      return NextResponse.json(
        await svc.accionCita(id, body.accion as 'reenviar' | 'confirmar' | 'detener' | 'validar')
      )
    }
    if (body.entidad === 'suspension') {
      return NextResponse.json(await svc.aplicarSuspension(id, String(body.fecha ?? '')))
    }
    return NextResponse.json(
      await svc.accionReporte(
        id,
        body.accion as 'reenviar' | 'detener' | 'confirmar' | 'denegar' | 'validar'
      )
    )
  } catch (e) {
    const { error, status } = jsonRacNivelError(e)
    return NextResponse.json({ error }, { status })
  }
}
