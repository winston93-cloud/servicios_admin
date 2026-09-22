import { NextResponse } from 'next/server'
import { enviarDevolucionAdmvo } from '@/lib/devolucionesService'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id: idRaw } = await ctx.params
    const devolucionId = Number(idRaw)
    const body = (await request.json()) as { realizadoPor?: string }

    const result = await enviarDevolucionAdmvo({
      devolucionId,
      realizadoPor: String(body.realizadoPor ?? ''),
    })

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error en el sistema'
    console.error('API devoluciones enviar-admvo:', e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
