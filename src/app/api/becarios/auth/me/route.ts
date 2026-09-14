import { NextResponse } from 'next/server'
import {
  jsonBecariosError,
  mePublico,
  opcionesCookieBecariosClear,
  requireBecariosSession,
} from '@/lib/becariosAuth'

export async function GET(req: Request) {
  try {
    const session = await requireBecariosSession(req)
    return NextResponse.json({
      ok: true,
      me: mePublico(session),
    })
  } catch (e) {
    const { error, status } = jsonBecariosError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(opcionesCookieBecariosClear())
  return res
}
