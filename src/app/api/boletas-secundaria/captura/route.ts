import { NextResponse } from 'next/server'
import { requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { guardarCaptura, listarAlumnosCaptura } from '@/lib/boletasCapturaService'
import { cicloEscolarActualBoletas } from '@/lib/boletasCiclo'

export async function GET(req: Request) {
  try {
    await requireBoletasSession(req)
    const url = new URL(req.url)
    const materiaId = Number(url.searchParams.get('materiaId'))
    const grupoLetra = String(url.searchParams.get('grupo') ?? 'ABC')
    const periodo = Number(url.searchParams.get('periodo') ?? 1)
    const ciclo = Number(url.searchParams.get('ciclo') ?? cicloEscolarActualBoletas())
    if (!materiaId) {
      return NextResponse.json({ error: 'materiaId requerido' }, { status: 400 })
    }
    const alumnos = await listarAlumnosCaptura({ materiaId, grupoLetra, periodo, ciclo })
    return jsonOk({ alumnos, materiaId, grupoLetra, periodo, ciclo })
  } catch (e) {
    return jsonError(e)
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireBoletasSession(req)
    const body = (await req.json()) as {
      materiaId?: number
      periodo?: number
      ciclo?: number
      filas?: {
        alumno_id: number
        calificacion?: string | null
        inasistencia?: number | null
        conducta?: string | null
        comprension?: string | null
      }[]
    }
    const materiaId = Number(body.materiaId)
    const periodo = Number(body.periodo ?? 1)
    const ciclo = Number(body.ciclo ?? cicloEscolarActualBoletas())
    if (!materiaId || !Array.isArray(body.filas)) {
      return NextResponse.json({ error: 'materiaId y filas requeridos' }, { status: 400 })
    }
    const result = await guardarCaptura({
      session,
      materiaId,
      periodo,
      ciclo,
      filas: body.filas,
    })
    return jsonOk({ ok: true, ...result })
  } catch (e) {
    return jsonError(e)
  }
}
