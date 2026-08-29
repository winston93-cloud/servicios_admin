import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { opcionesCookieSatModulo, SAT_MODULO_COOKIE } from '@/lib/sat/satModuloAuth'

export const runtime = 'nodejs'

export async function POST() {
  const jar = await cookies()
  jar.set(SAT_MODULO_COOKIE, '', { ...opcionesCookieSatModulo(), maxAge: 0 })
  return NextResponse.json({ ok: true })
}
