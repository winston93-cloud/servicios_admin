import { NextResponse } from 'next/server'
import { revisarAlertasMinimo } from '@/lib/talleres/talleresAlertaMinimo'
import { revisarAvisosInscripcionSinPago } from '@/lib/inscripcionSinPagoAvisos'

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
 * Cron diario (días hábiles): recordatorio (notificación + correo) de talleres que siguen en su cupo mínimo
 * y de alumnos con más de 30 días de referencia sin pagar inscripción.
 * Header: Authorization: Bearer $CRON_SECRET
 */
async function handle(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }
  const [talleres, inscripcion] = await Promise.allSettled([revisarAlertasMinimo(), revisarAvisosInscripcionSinPago()])
  if (talleres.status === 'rejected') console.error('cron talleres-minimo:', talleres.reason)
  if (inscripcion.status === 'rejected') console.error('cron inscripcion-sin-pago:', inscripcion.reason)
  const ok = talleres.status === 'fulfilled' && inscripcion.status === 'fulfilled'
  return NextResponse.json(
    {
      ok,
      ...(talleres.status === 'fulfilled' ? talleres.value : {}),
      inscripcion: inscripcion.status === 'fulfilled' ? inscripcion.value : null,
    },
    { status: ok ? 200 : 500 }
  )
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
