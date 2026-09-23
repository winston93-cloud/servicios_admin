import { NextResponse } from 'next/server'
import { completarFirmaDevolucion } from '@/lib/devolucionesService'

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idRaw } = await ctx.params
    const devolucionId = Number(idRaw)
    const body = (await request.json().catch(() => ({}))) as { realizadoPor?: string }
    const result = await completarFirmaDevolucion({
      devolucionId,
      realizadoPor: String(body.realizadoPor ?? ''),
    })
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true, row: result.row })
  } catch (e) {
    console.error('API devoluciones completar:', e)
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    )
  }
}
