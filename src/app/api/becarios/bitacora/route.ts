import { NextResponse } from 'next/server'
import { jsonBecariosError, requireBecariosSession } from '@/lib/becariosAuth'
import {
  finSemanaISO,
  guardarEntradaDia,
  hoyCDMX,
  inicioSemanaISO,
  listarEntradas,
  obtenerEntradaDia,
} from '@/lib/becariosService'

export async function GET(req: Request) {
  try {
    const session = await requireBecariosSession(req)
    const url = new URL(req.url)
    const fecha = url.searchParams.get('fecha')
    const desde = url.searchParams.get('desde')
    const hasta = url.searchParams.get('hasta')
    const modo = url.searchParams.get('modo') || 'rango'

    if (fecha) {
      const entrada = await obtenerEntradaDia(session, fecha)
      return NextResponse.json({ ok: true, entrada, hoy: hoyCDMX() })
    }

    let d = desde || ''
    let h = hasta || ''
    if (modo === 'semana') {
      const pivot = fecha || hoyCDMX()
      d = inicioSemanaISO(pivot)
      h = finSemanaISO(pivot)
    } else if (!d && !h) {
      h = hoyCDMX()
      const dt = new Date(`${h}T12:00:00`)
      dt.setDate(dt.getDate() - 30)
      d = dt.toISOString().slice(0, 10)
    }

    const entradas = await listarEntradas(session, { desde: d || undefined, hasta: h || undefined })
    return NextResponse.json({ ok: true, entradas, desde: d, hasta: h, hoy: hoyCDMX() })
  } catch (e) {
    const { error, status } = jsonBecariosError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireBecariosSession(req)
    const body = (await req.json()) as {
      entrada_fecha?: string
      entrada_titulo?: string
      avances?: string
      observaciones?: string
      apuntes?: string
      pendientes?: string
      aprendizajes?: string
      horas_aproximadas?: number | null
      estado?: 'borrador' | 'publicado'
    }
    const entrada = await guardarEntradaDia(session, {
      entrada_fecha: String(body.entrada_fecha || hoyCDMX()),
      entrada_titulo: body.entrada_titulo,
      avances: String(body.avances ?? ''),
      observaciones: body.observaciones,
      apuntes: body.apuntes,
      pendientes: body.pendientes,
      aprendizajes: body.aprendizajes,
      horas_aproximadas: body.horas_aproximadas,
      estado: body.estado,
    })
    return NextResponse.json({ ok: true, entrada })
  } catch (e) {
    const { error, status } = jsonBecariosError(e)
    return NextResponse.json({ error }, { status })
  }
}
