import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  DIRECTOR_SESSION_COOKIE,
  hasStaffSession,
  staffSessionFromRequest,
} from '@/lib/admission/staffAuth'

const COOKIE_MAX_AGE = 60 * 60 * 12

const PINS: Record<string, string | undefined> = {
  maternal_kinder: process.env.DIRECTOR_PIN_MK,
  primaria:        process.env.DIRECTOR_PIN_PRI,
  secundaria:      process.env.DIRECTOR_PIN_SEC,
}

export async function POST(request: Request) {
  const staffOk = staffSessionFromRequest(request) || (await hasStaffSession())
  if (!staffOk) {
    return NextResponse.json({ error: 'Sesión de personal requerida' }, { status: 401 })
  }

  const { level, pin } = await request.json()
  if (!level || !PINS[level]) {
    return NextResponse.json({ error: 'Nivel inválido o PIN no configurado' }, { status: 400 })
  }

  if (pin !== PINS[level]) {
    return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
  }

  const cookieStore = await cookies()
  cookieStore.set(DIRECTOR_SESSION_COOKIE, level, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })

  return NextResponse.json({ ok: true, level })
}

export async function GET() {
  const cookieStore = await cookies()
  const level = cookieStore.get(DIRECTOR_SESSION_COOKIE)?.value
  if (!level) return NextResponse.json({ level: null })
  return NextResponse.json({ level })
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete(DIRECTOR_SESSION_COOKIE)
  return NextResponse.json({ ok: true })
}
