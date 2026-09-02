import { NextResponse } from 'next/server'
import { obtenerAlumnoPorId } from '@/lib/alumnoDatosService'
import { createInsforgeAdmin } from '@/lib/insforgeAdmin'
import {
  audienciaNewsDesdeNivel,
  etiquetaAudienciaNews,
  type AudienciaNews,
} from '@/lib/portalNewsDesayunosAudiencia'
import {
  listarPublicaciones,
  mapPublicacionRespuesta,
  obtenerNewsParaAlumno,
} from '@/lib/portalNewsDesayunosService'
import {
  etiquetaMesAnio,
  parsearPeriodoMes,
  periodoActualMx,
} from '@/lib/portalNewsDesayunosMes'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const actual = periodoActualMx()
    const periodo =
      parsearPeriodoMes(
        url.searchParams.get('anio') ?? actual.anio,
        url.searchParams.get('mes') ?? actual.mes
      ) ?? actual

    const alumnoId = Number(url.searchParams.get('alumnoId'))
    let audienciaNews: AudienciaNews | null = null
    let audienciaLabel: string | null = null

    if (Number.isFinite(alumnoId) && alumnoId > 0) {
      const alumno = await obtenerAlumnoPorId(alumnoId)
      if (alumno) {
        audienciaNews = audienciaNewsDesdeNivel(alumno.alumno_nivel)
        if (audienciaNews) {
          audienciaLabel = etiquetaAudienciaNews(audienciaNews)
        }
      }
    }

    const client = createInsforgeAdmin()
    const filas = await listarPublicaciones(client.database, {
      anio: periodo.anio,
      mes: periodo.mes,
    })

    const desayunos = filas.find((f) => f.tipo === 'desayunos') ?? null

    let news = null
    if (audienciaNews) {
      const row =
        (await obtenerNewsParaAlumno(
          client.database,
          periodo.anio,
          periodo.mes,
          audienciaNews
        )) ?? filas.find((f) => f.tipo === 'news' && f.audiencia === audienciaNews) ?? null
      news = row ? mapPublicacionRespuesta(row) : null
    } else {
      const legacy = filas.find((f) => f.tipo === 'news') ?? null
      news = legacy ? mapPublicacionRespuesta(legacy) : null
    }

    return NextResponse.json({
      periodo: {
        anio: periodo.anio,
        mes: periodo.mes,
        etiqueta: etiquetaMesAnio(periodo.anio, periodo.mes),
        esActual:
          periodo.anio === actual.anio && periodo.mes === actual.mes,
      },
      audiencia: audienciaNews,
      audiencia_label: audienciaLabel,
      news,
      desayunos: desayunos ? mapPublicacionRespuesta(desayunos) : null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar publicaciones'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
