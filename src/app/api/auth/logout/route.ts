import { NextResponse } from 'next/server'
import { borrarCookieSesionPortal } from '@/lib/portalSesionFirmada'

export const runtime = 'nodejs'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  borrarCookieSesionPortal(res)
  return res
}
