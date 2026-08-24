import { NextResponse } from 'next/server'
import { jsonRacError, requireRacSession } from '@/lib/racAuth'
import { puedeAccionCoord, puedeVerVistaCoord } from '@/lib/racPermisos'
import {
  accionCita,
  accionReporte,
  aplicarSuspension,
  historialAlumno,
  inboxCitas,
  inboxReportes,
  inboxSuspensiones,
} from '@/lib/racService'

export async function GET(req: Request) {
  try {
    const session = await requireRacSession(req)
    const url = new URL(req.url)
    const vista = url.searchParams.get('vista') ?? 'pendientes'
    if (!puedeVerVistaCoord(session.role, vista)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (vista === 'citas') return NextResponse.json({ filas: await inboxCitas(session) })
    if (vista === 'suspensiones') return NextResponse.json({ filas: await inboxSuspensiones() })
    if (vista === 'historial') {
      const h = await historialAlumno(String(url.searchParams.get('q') ?? ''))
      return NextResponse.json({ filas: h.reportes, alumnos: h.alumnos })
    }
    const filtro = vista === 'informes' || vista === 'todos' ? vista : 'pendientes'
    return NextResponse.json({ filas: await inboxReportes(session, filtro) })
  } catch (e) {
    const { error, status } = jsonRacError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRacSession(req)
    const body = (await req.json()) as {
      entidad?: string
      id?: number
      accion?: string
      fecha?: string
    }
    const entidad = body.entidad === 'cita' ? 'cita' : body.entidad === 'suspension' ? 'suspension' : 'reporte'
    const accion = String(body.accion ?? '')
    if (!puedeAccionCoord(session.role, entidad, accion)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    const id = Number(body.id)
    if (body.entidad === 'cita') {
      return NextResponse.json(
        await accionCita(id, body.accion as 'reenviar' | 'confirmar' | 'detener' | 'validar')
      )
    }
    if (body.entidad === 'suspension') {
      return NextResponse.json(await aplicarSuspension(id, String(body.fecha ?? '')))
    }
    return NextResponse.json(
      await accionReporte(
        id,
        body.accion as 'reenviar' | 'detener' | 'confirmar' | 'denegar' | 'validar'
      )
    )
  } catch (e) {
    const { error, status } = jsonRacError(e)
    return NextResponse.json({ error }, { status })
  }
}
