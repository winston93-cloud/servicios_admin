import { NextResponse } from 'next/server'
import { sesionPortalDeRequest } from '@/lib/portalSesionFirmada'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = sesionPortalDeRequest(request)
  if (!session) return NextResponse.json({ ok: false }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json({ ok: true, session }, { headers: { 'Cache-Control': 'no-store' } })
}
