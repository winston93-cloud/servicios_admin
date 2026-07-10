import { NextResponse } from 'next/server'
import { createInsforgeAdmin } from '@/lib/insforgeAdmin'
import {
  eliminarReglamento,
  guardarReglamentoPdf,
  hrefReglamentoArchivo,
  listarReglamentosPorCiclo,
} from '@/lib/reglamentosEscolaresService'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const ciclo = Number(new URL(request.url).searchParams.get('ciclo'))
    if (!Number.isFinite(ciclo) || ciclo <= 0) {
      return NextResponse.json({ error: 'ciclo requerido' }, { status: 400 })
    }

    const client = createInsforgeAdmin()
    const filas = await listarReglamentosPorCiclo(client.database, ciclo)

    return NextResponse.json({
      ciclo,
      reglamentos: filas.map((r) => ({
        ...r,
        etiqueta: etiquetaNivelEscolar(r.nivel),
        href: hrefReglamentoArchivo(r.nivel, r.ciclo_valor),
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al listar reglamentos'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const nivel = Number(form.get('nivel'))
    const ciclo = Number(form.get('ciclo'))
    const file = form.get('archivo')

    if (!nivel || nivel < 1 || nivel > 4) {
      return NextResponse.json({ error: 'nivel 1-4 requerido' }, { status: 400 })
    }
    if (!Number.isFinite(ciclo) || ciclo <= 0) {
      return NextResponse.json({ error: 'ciclo escolar requerido' }, { status: 400 })
    }
    if (!(file instanceof File) || !file.size) {
      return NextResponse.json({ error: 'archivo PDF requerido' }, { status: 400 })
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Solo se aceptan archivos PDF' }, { status: 400 })
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'Máximo 15 MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const client = createInsforgeAdmin()
    const registro = await guardarReglamentoPdf(client, {
      nivel,
      cicloValor: ciclo,
      buffer,
      nombreArchivo: file.name,
    })

    return NextResponse.json({
      ok: true,
      reglamento: {
        ...registro,
        etiqueta: etiquetaNivelEscolar(registro.nivel),
        href: hrefReglamentoArchivo(registro.nivel, registro.ciclo_valor),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al subir reglamento'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
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
    await eliminarReglamento(client, nivel, ciclo)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al eliminar reglamento'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
