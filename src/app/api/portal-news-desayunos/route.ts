import { NextResponse } from 'next/server'
import { createInsforgeAdmin } from '@/lib/insforgeAdmin'
import {
  listarPublicaciones,
  mapPublicacionRespuesta,
  obtenerPublicacion,
  type TipoPublicacionNewsDesayunos,
} from '@/lib/portalNewsDesayunosService'
import {
  etiquetaMesAnio,
  parsearPeriodoMes,
  periodoActualMx,
} from '@/lib/portalNewsDesayunosMes'

export const runtime = 'nodejs'

function parseTipo(raw: string | null): TipoPublicacionNewsDesayunos | null {
  if (raw === 'news' || raw === 'desayunos') return raw
  return null
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const actual = periodoActualMx()
    const periodo =
      parsearPeriodoMes(
        url.searchParams.get('anio') ?? actual.anio,
        url.searchParams.get('mes') ?? actual.mes
      ) ?? actual

    const client = createInsforgeAdmin()
    const filas = await listarPublicaciones(client.database, {
      anio: periodo.anio,
      mes: periodo.mes,
    })

    const news = filas.find((f) => f.tipo === 'news') ?? null
    const desayunos = filas.find((f) => f.tipo === 'desayunos') ?? null

    return NextResponse.json({
      periodo: {
        anio: periodo.anio,
        mes: periodo.mes,
        etiqueta: etiquetaMesAnio(periodo.anio, periodo.mes),
        esActual:
          periodo.anio === actual.anio && periodo.mes === actual.mes,
      },
      news: news ? mapPublicacionRespuesta(news) : null,
      desayunos: desayunos ? mapPublicacionRespuesta(desayunos) : null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar publicaciones'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
