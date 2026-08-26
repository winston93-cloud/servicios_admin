import { NextResponse } from 'next/server'
import { liberarTramiteAdministrativo } from '@/lib/controlEscolarTramitesService'
import { puedeLiberarTramiteAdministrativo } from '@/lib/controlEscolarLiberarPermisos'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tramiteId?: number
      liberadoPor?: string
      usuarioUsername?: string
    }
    const username = String(body.usuarioUsername ?? body.liberadoPor ?? '')
    if (!puedeLiberarTramiteAdministrativo(username)) {
      return NextResponse.json(
        {
          ok: false,
          mensaje:
            'No tiene permiso para liberar trámites. Solo Laura, Juanita o Mario.',
        },
        { status: 403 }
      )
    }
    const result = await liberarTramiteAdministrativo({
      tramiteId: Number(body.tramiteId),
      liberadoPor: String(body.liberadoPor ?? username),
    })
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error en el sistema'
    console.error('API control-escolar/tramites/liberar:', e)
    return NextResponse.json({ ok: false, mensaje: message }, { status: 500 })
  }
}
