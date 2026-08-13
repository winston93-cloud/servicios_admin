import { NextResponse } from 'next/server'
import { requireAdmin, requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { obtenerBimestreActivo, setBimestreActivo } from '@/lib/boletasCapturaService'

export async function GET(req: Request) {
  try {
    await requireBoletasSession(req)
    return jsonOk(await obtenerBimestreActivo())
  } catch (e) {
    return jsonError(e)
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireBoletasSession(req)
    requireAdmin(session)
    const body = (await req.json()) as { periodo?: number; etiqueta?: string }
    const periodo = Number(body.periodo)
    if (![1, 2, 3].includes(periodo)) {
      return NextResponse.json({ error: 'Periodo inválido' }, { status: 400 })
    }
    await setBimestreActivo(periodo, body.etiqueta)
    return jsonOk(await obtenerBimestreActivo())
  } catch (e) {
    return jsonError(e)
  }
}
