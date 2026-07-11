import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  copiarPreciosCiclo,
  listarPreciosCompletosPorCiclo,
  upsertPrecioBoucher,
  type CostoBoucherInput,
} from '@/lib/costosBoucherService'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const ciclo = Number(new URL(request.url).searchParams.get('ciclo'))
    if (!Number.isFinite(ciclo) || ciclo <= 0) {
      return NextResponse.json({ error: 'ciclo requerido' }, { status: 400 })
    }

    const db = createDbAdmin()
    const filas = await listarPreciosCompletosPorCiclo(db, ciclo)

    return NextResponse.json({
      ok: true,
      ciclo,
      filas: filas.map((f) => ({
        ...f,
        etiqueta: etiquetaNivelEscolar(f.alumno_nivel),
        /** Monto único para concepto 17 en UI. */
        evaluacion_herramientas: f.precio_material + f.precio_seguro,
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al listar costos'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      ciclo?: number
      nivel?: number
    } & Partial<CostoBoucherInput> & { evaluacion_herramientas?: number }

    const ciclo = Number(body.ciclo)
    const nivel = Number(body.nivel)
    if (!Number.isFinite(ciclo) || ciclo <= 0) {
      return NextResponse.json({ error: 'ciclo requerido' }, { status: 400 })
    }
    if (!nivel || nivel < 1 || nivel > 4) {
      return NextResponse.json({ error: 'nivel 1-4 requerido' }, { status: 400 })
    }

    const material =
      body.evaluacion_herramientas != null
        ? Number(body.evaluacion_herramientas)
        : Number(body.precio_material ?? 0)

    const input: CostoBoucherInput = {
      precio_inscripcion: Number(body.precio_inscripcion ?? 0),
      precio_agosto: Number(body.precio_agosto ?? 0),
      precio_colegiatura: Number(body.precio_colegiatura ?? 0),
      precio_colegiatura2: Number(body.precio_colegiatura2 ?? 0),
      precio_material: material,
      precio_cuota_padres: Number(body.precio_cuota_padres ?? 0),
      precio_cambridge: Number(body.precio_cambridge ?? 0),
      precio_dtitulacion: Number(body.precio_dtitulacion ?? 0),
      descuento_cambio_nivel: Number(body.descuento_cambio_nivel ?? 0),
      descuento_cambio_grado: Number(body.descuento_cambio_grado ?? 0),
    }

    const db = createDbAdmin()
    const fila = await upsertPrecioBoucher(db, ciclo, nivel, input)

    return NextResponse.json({
      ok: true,
      fila: {
        ...fila,
        etiqueta: etiquetaNivelEscolar(fila.alumno_nivel),
        evaluacion_herramientas: fila.precio_material + fila.precio_seguro,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al guardar costos'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      cicloOrigen?: number
      cicloDestino?: number
    }
    const cicloOrigen = Number(body.cicloOrigen)
    const cicloDestino = Number(body.cicloDestino)

    if (!Number.isFinite(cicloOrigen) || cicloOrigen <= 0) {
      return NextResponse.json({ error: 'cicloOrigen requerido' }, { status: 400 })
    }
    if (!Number.isFinite(cicloDestino) || cicloDestino <= 0) {
      return NextResponse.json({ error: 'cicloDestino requerido' }, { status: 400 })
    }

    const db = createDbAdmin()
    const result = await copiarPreciosCiclo(db, cicloOrigen, cicloDestino)

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al copiar costos'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
