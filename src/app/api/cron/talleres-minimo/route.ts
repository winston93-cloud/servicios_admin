import { NextResponse } from 'next/server'
import { revisarAlertasMinimo } from '@/lib/talleres/talleresAlertaMinimo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function autorizado(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return process.env.NODE_ENV !== 'production'
  const auth = request.headers.get('authorization') ?? ''
  if (auth === `Bearer ${secret}`) return true
  return new URL(request.url).searchParams.get('secret') === secret
}

/**
 * Cron diario: recordatorio (notificación + correo) de talleres que siguen en su cupo mínimo.
 * Header: Authorization: Bearer $CRON_SECRET
 */
async function handle(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }
  try {
    return NextResponse.json({ ok: true, ...(await revisarAlertasMinimo()) })
  } catch (e) {
    console.error('cron talleres-minimo:', e)
    return NextResponse.json({ ok: false, error: 'Error al revisar talleres en mínimo' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
