import { NextResponse } from 'next/server'
import { liberarTramiteAdministrativo } from '@/lib/controlEscolarTramitesService'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tramiteId?: number
      liberadoPor?: string
    }
    const result = await liberarTramiteAdministrativo({
      tramiteId: Number(body.tramiteId),
      liberadoPor: String(body.liberadoPor ?? ''),
    })
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error en el sistema'
    console.error('API control-escolar/tramites/liberar:', e)
    return NextResponse.json({ ok: false, mensaje: message }, { status: 500 })
  }
}
