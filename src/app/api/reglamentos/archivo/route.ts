import { NextResponse } from 'next/server'
import { createInsforgeAdmin } from '@/lib/insforgeAdmin'
import {
  obtenerReglamento,
  REGLAMENTOS_BUCKET,
} from '@/lib/reglamentosEscolaresService'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const nivel = Number(url.searchParams.get('nivel'))
    const ciclo = Number(url.searchParams.get('ciclo'))

    if (!nivel || nivel < 1 || nivel > 4) {
      return NextResponse.json({ error: 'nivel 1-4 requerido' }, { status: 400 })
    }
    if (!Number.isFinite(ciclo) || ciclo <= 0) {
      return NextResponse.json({ error: 'ciclo requerido' }, { status: 400 })
    }

    const client = createInsforgeAdmin()
    const registro = await obtenerReglamento(client.database, nivel, ciclo)
    if (!registro?.storage_key) {
      return NextResponse.json({ error: 'Reglamento no publicado' }, { status: 404 })
    }

    const { data, error } = await client.storage
      .from(REGLAMENTOS_BUCKET)
      .download(registro.storage_key)

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? 'No se pudo descargar el PDF' },
        { status: 404 }
      )
    }

    const bytes = new Uint8Array(await data.arrayBuffer())
    const nombre =
      registro.nombre_archivo?.replace(/[^\w.\-]+/g, '_') ||
      `reglamento_nivel${nivel}_ciclo${ciclo}.pdf`

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nombre}"`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al servir reglamento'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
