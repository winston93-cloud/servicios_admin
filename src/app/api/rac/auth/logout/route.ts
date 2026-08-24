import { NextResponse } from 'next/server'
import { RAC_AUTH_COOKIE } from '@/lib/racAuth'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set({
    name: RAC_AUTH_COOKIE,
    value: '',
    httpOnly: true,
    path: '/',
    maxAge: 0,
  })
  return res
}
