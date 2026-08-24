import { NextResponse } from 'next/server'
import { enviarRecordatoriosLiberacionDocumentosNi } from '@/lib/portalDocsRecordatorioLiberacion'
import { enviarRecordatoriosTramitesAdministrativos } from '@/lib/controlEscolarTramitesService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Cron diario: puede tardar si hay muchos pendientes + SMTP. */
export const maxDuration = 60

function autorizado(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    // En local sin secret: permitir solo si no es producción
    return process.env.NODE_ENV !== 'production'
  }
  const auth = request.headers.get('authorization') ?? ''
  if (auth === `Bearer ${secret}`) return true
  const url = new URL(request.url)
  return url.searchParams.get('secret') === secret
}

/**
 * Recordatorio cada 24 h a control escolar:
 * - docs NI enviados por papás sin liberar
 * - trámites administrativos pagados sin elaborar
 *
 * Vercel Cron: GET/POST /api/cron/recordatorio-liberacion-docs
 * Header: Authorization: Bearer $CRON_SECRET
 */
async function handle(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const result = await enviarRecordatoriosLiberacionDocumentosNi()
    const tramites = await enviarRecordatoriosTramitesAdministrativos()
    return NextResponse.json(
      { ...result, tramites },
      { status: result.ok && tramites.ok ? 200 : 502 }
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error en recordatorio'
    console.error('cron recordatorio-liberacion-docs:', e)
    return NextResponse.json({ ok: false, mensaje: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
