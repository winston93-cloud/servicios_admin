import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import {
  guardarCuotaInicioBeca100,
  listarBecadosCien,
  listarCuotaInicioBeca100,
} from '@/lib/cuotaInicioBeca100Service'

export const runtime = 'nodejs'

async function respuesta(ciclo: number) {
  const db = createDbAdmin()
  const [niveles, becados] = await Promise.all([
    listarCuotaInicioBeca100(db, ciclo),
    listarBecadosCien(db, ciclo),
  ])
  return NextResponse.json({ ok: true, ciclo, niveles, becados })
}

function cicloDe(valor: unknown): number | null {
  const ciclo = Number(valor)
  return Number.isInteger(ciclo) && ciclo > 0 ? ciclo : null
}

export async function GET(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  try {
    const ciclo = cicloDe(new URL(request.url).searchParams.get('ciclo'))
    if (ciclo == null) return NextResponse.json({ error: 'ciclo requerido' }, { status: 400 })
    return await respuesta(ciclo)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al leer la cuota de inicio para becados 100%'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json()) as {
      ciclo?: number
      montos?: { nivel?: number; monto?: number }[]
    }
    const ciclo = cicloDe(body.ciclo)
    if (ciclo == null) return NextResponse.json({ error: 'ciclo requerido' }, { status: 400 })
    const montos = (body.montos ?? []).map((m) => ({ nivel: Number(m.nivel), monto: Number(m.monto) }))
    if (!montos.length) return NextResponse.json({ error: 'montos requeridos' }, { status: 400 })
    await guardarCuotaInicioBeca100(createDbAdmin(), ciclo, montos)
    return await respuesta(ciclo)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al guardar la cuota de inicio para becados 100%'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
