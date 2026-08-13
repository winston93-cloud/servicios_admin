import { NextResponse } from 'next/server'
import { BOLETAS_AUTH_COOKIE } from '@/lib/boletasAuth'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set({
    name: BOLETAS_AUTH_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
