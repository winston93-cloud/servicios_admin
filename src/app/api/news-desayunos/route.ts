import { NextResponse } from 'next/server'
import { createInsforgeAdmin } from '@/lib/insforgeAdmin'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { parseAudienciaNews } from '@/lib/portalNewsDesayunosAudiencia'
import {
  audienciaParaTipo,
  eliminarPublicacion,
  guardarPublicacionArchivo,
  listarPublicaciones,
  mapPublicacionRespuesta,
  type TipoPublicacionNewsDesayunos,
} from '@/lib/portalNewsDesayunosService'
import { parsearPeriodoMes } from '@/lib/portalNewsDesayunosMes'

export const runtime = 'nodejs'

const MAX_BYTES = 20 * 1024 * 1024

function parseTipo(raw: string | null): TipoPublicacionNewsDesayunos | null {
  if (raw === 'news' || raw === 'desayunos') return raw
  return null
}

export async function GET(request: Request) {
  try {
    const auth = requireEmpleadoPortal(request)
    if (!auth.ok) return auth.response

    const url = new URL(request.url)
    const anio = url.searchParams.get('anio')
    const mes = url.searchParams.get('mes')
    const periodo = anio && mes ? parsearPeriodoMes(anio, mes) : null

    const client = createInsforgeAdmin()
    const filas = await listarPublicaciones(
      client.database,
      periodo ? { anio: periodo.anio, mes: periodo.mes } : undefined
    )

    return NextResponse.json({
      publicaciones: filas.map(mapPublicacionRespuesta),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al listar publicaciones'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = requireEmpleadoPortal(request)
    if (!auth.ok) return auth.response

    const form = await request.formData()
    const tipo = parseTipo(String(form.get('tipo') ?? ''))
    const periodo = parsearPeriodoMes(form.get('anio'), form.get('mes'))
    const file = form.get('archivo')
    const audienciaRaw = String(form.get('audiencia') ?? '').trim()

    if (!tipo) {
      return NextResponse.json({ error: 'tipo news o desayunos requerido' }, { status: 400 })
    }
    if (!periodo) {
      return NextResponse.json({ error: 'mes y año válidos requeridos' }, { status: 400 })
    }
    if (tipo === 'news' && !parseAudienciaNews(audienciaRaw)) {
      return NextResponse.json(
        { error: 'audiencia requerida: educativo, primaria o secundaria' },
        { status: 400 }
      )
    }
    if (!(file instanceof File) || !file.size) {
      return NextResponse.json({ error: 'archivo requerido' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Máximo 20 MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const client = createInsforgeAdmin()
    const creadoPor =
      auth.session.usuario_username?.trim() ||
      auth.session.displayName?.trim() ||
      'empleado'

    const registro = await guardarPublicacionArchivo(client, {
      tipo,
      anio: periodo.anio,
      mes: periodo.mes,
      buffer,
      nombreArchivo: file.name,
      mimeType: file.type,
      creadoPor,
      audiencia: tipo === 'news' ? audienciaRaw : undefined,
    })

    return NextResponse.json({
      ok: true,
      publicacion: mapPublicacionRespuesta(registro),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al subir archivo'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = requireEmpleadoPortal(request)
    if (!auth.ok) return auth.response

    const url = new URL(request.url)
    const tipo = parseTipo(url.searchParams.get('tipo'))
    const periodo = parsearPeriodoMes(
      url.searchParams.get('anio'),
      url.searchParams.get('mes')
    )
    const audienciaRaw = url.searchParams.get('audiencia')

    if (!tipo || !periodo) {
      return NextResponse.json({ error: 'tipo, mes y año requeridos' }, { status: 400 })
    }

    let audiencia: string
    try {
      audiencia = audienciaParaTipo(tipo, audienciaRaw)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'audiencia inválida'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const client = createInsforgeAdmin()
    await eliminarPublicacion(client, tipo, periodo.anio, periodo.mes, audiencia)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al eliminar'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
