import { NextResponse } from 'next/server'
import { STAFF_SESSION_COOKIE } from '@/lib/admission/staffAuth'
import { parsePortalSessionHeader } from '@/lib/insforgeDbProxyShared'

const COOKIE_MAX_AGE = 60 * 60 * 12

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  }
}

export async function POST(request: Request) {
  const session = parsePortalSessionHeader(request.headers.get('x-portal-session'))
  if (session?.role !== 'usuario') {
    return NextResponse.json({ error: 'Sesión de personal requerida' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(STAFF_SESSION_COOKIE, '1', cookieOptions(COOKIE_MAX_AGE))
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(STAFF_SESSION_COOKIE, '', cookieOptions(0))
  return response
}
