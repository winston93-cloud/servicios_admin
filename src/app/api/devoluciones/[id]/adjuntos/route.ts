import { NextResponse } from 'next/server'
import { subirAdjuntosDevolucion } from '@/lib/devolucionesService'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id: idRaw } = await ctx.params
    const devolucionId = Number(idRaw)
    const body = (await request.json()) as {
      realizadoPor?: string
      archivos?: { nombre?: string; mimeType?: string; base64?: string }[]
    }

    const result = await subirAdjuntosDevolucion({
      devolucionId,
      realizadoPor: String(body.realizadoPor ?? ''),
      archivos: (body.archivos ?? []).map((a) => ({
        nombre: String(a.nombre ?? 'archivo'),
        mimeType: String(a.mimeType ?? 'application/pdf'),
        base64: String(a.base64 ?? ''),
      })),
    })

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error en el sistema'
    console.error('API devoluciones adjuntos:', e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
