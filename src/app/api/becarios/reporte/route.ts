import { NextResponse } from 'next/server'
import { jsonBecariosError, requireBecariosSession } from '@/lib/becariosAuth'
import { excelBitacoraBecario, pdfBitacoraBecario } from '@/lib/becariosReportes'
import {
  etiquetaAlcanceReporte,
  finSemanaISO,
  hoyCDMX,
  inicioSemanaISO,
  listarEntradas,
} from '@/lib/becariosService'

export async function GET(req: Request) {
  try {
    const session = await requireBecariosSession(req)
    const url = new URL(req.url)
    const formato = (url.searchParams.get('formato') || 'pdf').toLowerCase()
    const periodo = url.searchParams.get('periodo') || 'rango' // dia | semana | rango
    const pivot = url.searchParams.get('fecha') || hoyCDMX()
    const becario = url.searchParams.get('becario') || undefined
    let desde = url.searchParams.get('desde') || ''
    let hasta = url.searchParams.get('hasta') || ''

    if (periodo === 'dia') {
      desde = pivot
      hasta = pivot
    } else if (periodo === 'semana') {
      desde = inicioSemanaISO(pivot)
      hasta = finSemanaISO(pivot)
    } else {
      if (!desde) desde = inicioSemanaISO(pivot)
      if (!hasta) hasta = hoyCDMX()
    }

    const entradas = await listarEntradas(session, {
      desde,
      hasta,
      limit: 200,
      becario,
    })
    const alcance = etiquetaAlcanceReporte(session, becario)
    const slug =
      session.role === 'revisor'
        ? `revision-${(becario || 'todos').replace(/[^a-z0-9_-]/gi, '')}`
        : session.username
    const base = `bitacora-${slug}-${desde}_${hasta}`

    if (formato === 'xlsx' || formato === 'excel') {
      const buf = await excelBitacoraBecario({
        nombre: alcance,
        desde,
        hasta,
        entradas,
      })
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${base}.xlsx"`,
        },
      })
    }

    const buf = pdfBitacoraBecario({
      nombre: alcance,
      desde,
      hasta,
      entradas,
    })
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${base}.pdf"`,
      },
    })
  } catch (e) {
    const { error, status } = jsonBecariosError(e)
    return NextResponse.json({ error }, { status })
  }
}
