import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  copiarFechasDiferidosCiclo,
  listarFechasDiferidos,
  obtenerFechasDiferidos,
  upsertFechasDiferidos,
  type FechasDiferidosInput,
} from '@/lib/fechasDiferidosService'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const ciclo = Number(new URL(request.url).searchParams.get('ciclo'))
    const db = createDbAdmin()

    if (Number.isFinite(ciclo) && ciclo > 0) {
      const fila = await obtenerFechasDiferidos(db, ciclo)
      return NextResponse.json({ ok: true, ciclo, fila })
    }

    const filas = await listarFechasDiferidos(db)
    return NextResponse.json({ ok: true, filas })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al listar fechas de diferidos'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      ciclo?: number
      copiarDesde?: number
    } & Partial<FechasDiferidosInput>

    const ciclo = Number(body.ciclo)
    if (!Number.isFinite(ciclo) || ciclo <= 0) {
      return NextResponse.json({ error: 'ciclo requerido' }, { status: 400 })
    }

    const db = createDbAdmin()

    if (body.copiarDesde != null) {
      const desde = Number(body.copiarDesde)
      if (!Number.isFinite(desde) || desde <= 0) {
        return NextResponse.json({ error: 'copiarDesde inválido' }, { status: 400 })
      }
      const fila = await copiarFechasDiferidosCiclo(db, desde, ciclo)
      return NextResponse.json({ ok: true, fila })
    }

    const input: FechasDiferidosInput = {
      plan10_dif1_ini: String(body.plan10_dif1_ini ?? ''),
      plan10_dif1_fin: String(body.plan10_dif1_fin ?? ''),
      plan10_dif2_ini: String(body.plan10_dif2_ini ?? ''),
      plan10_dif2_fin: String(body.plan10_dif2_fin ?? ''),
      plan11_dif1_ini: String(body.plan11_dif1_ini ?? ''),
      plan11_dif1_fin: String(body.plan11_dif1_fin ?? ''),
      plan11_dif2_ini: String(body.plan11_dif2_ini ?? ''),
      plan11_dif2_fin: String(body.plan11_dif2_fin ?? ''),
    }

    const fila = await upsertFechasDiferidos(db, ciclo, input)
    return NextResponse.json({ ok: true, fila })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al guardar fechas de diferidos'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
