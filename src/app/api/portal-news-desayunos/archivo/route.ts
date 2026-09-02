import { NextResponse } from 'next/server'
import { createInsforgeAdmin } from '@/lib/insforgeAdmin'
import { parseAudienciaNews } from '@/lib/portalNewsDesayunosAudiencia'
import {
  audienciaParaTipo,
  NEWS_DESAYUNOS_BUCKET,
  obtenerPublicacion,
  type TipoPublicacionNewsDesayunos,
} from '@/lib/portalNewsDesayunosService'
import { parsearPeriodoMes } from '@/lib/portalNewsDesayunosMes'

export const runtime = 'nodejs'

function parseTipo(raw: string | null): TipoPublicacionNewsDesayunos | null {
  if (raw === 'news' || raw === 'desayunos') return raw
  return null
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const tipo = parseTipo(url.searchParams.get('tipo'))
    const periodo = parsearPeriodoMes(
      url.searchParams.get('anio'),
      url.searchParams.get('mes')
    )

    if (!tipo || !periodo) {
      return NextResponse.json(
        { error: 'tipo, mes y año requeridos' },
        { status: 400 }
      )
    }

    let audiencia: string
    try {
      const rawAud = url.searchParams.get('audiencia')
      if (tipo === 'news' && !parseAudienciaNews(rawAud)) {
        return NextResponse.json(
          { error: 'audiencia requerida para news' },
          { status: 400 }
        )
      }
      audiencia = audienciaParaTipo(tipo, rawAud)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'audiencia inválida'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const client = createInsforgeAdmin()
    const registro = await obtenerPublicacion(
      client.database,
      tipo,
      periodo.anio,
      periodo.mes,
      audiencia
    )
    if (!registro?.storage_key) {
      return NextResponse.json({ error: 'Archivo no publicado' }, { status: 404 })
    }

    const { data, error } = await client.storage
      .from(NEWS_DESAYUNOS_BUCKET)
      .download(registro.storage_key)

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? 'No se pudo descargar el archivo' },
        { status: 404 }
      )
    }

    const bytes = new Uint8Array(await data.arrayBuffer())
    const nombre =
      registro.nombre_archivo?.replace(/[^\w.\-]+/g, '_') ||
      `${tipo}_${periodo.anio}-${String(periodo.mes).padStart(2, '0')}`

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': registro.mime_type || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${nombre}"`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al servir archivo'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
