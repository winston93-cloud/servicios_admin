import { NextResponse } from 'next/server'
import { opcionesCookieRacClear } from '@/lib/racAuth'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(opcionesCookieRacClear())
  return res
}
