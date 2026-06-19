import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { hasStaffSession, staffSessionFromRequest, ADMIN_SESSION_COOKIE } from '@/lib/admission/staffAuth'

const COOKIE_MAX_AGE = 60 * 60 * 12

export const ADMIN_ROLES: Record<string, { label: string; group: string }> = {
  psi_mk:  { label: 'Psicología Maternal y Kinder', group: 'Psicología' },
  psi_pri: { label: 'Psicología Primaria',           group: 'Psicología' },
  psi_sec: { label: 'Psicología Secundaria',         group: 'Psicología' },
  vin_mk:  { label: 'Vinculación Maternal y Kinder', group: 'Vinculación' },
  vin_pri: { label: 'Vinculación Primaria y Secundaria', group: 'Vinculación' },
}

export async function POST(request: Request) {
  const staffOk = staffSessionFromRequest(request) || (await hasStaffSession())
  if (!staffOk) {
    return NextResponse.json({ error: 'Sesión de personal requerida' }, { status: 401 })
  }

  const { role } = await request.json()
  if (!role || !(role in ADMIN_ROLES)) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
  }

  const cookieStore = await cookies()
  cookieStore.set(ADMIN_SESSION_COOKIE, role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })

  return NextResponse.json({ ok: true, role })
}

export async function GET() {
  const cookieStore = await cookies()
  const role = cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? null
  return NextResponse.json({ role })
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete(ADMIN_SESSION_COOKIE)
  return NextResponse.json({ ok: true })
}
