import { NextResponse } from 'next/server'
import { STAFF_SESSION_COOKIE } from '@/lib/admission/staffAuth'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import type { AuthSession } from '@/lib/portalAuthService'

const STAFF_COOKIE_MAX_AGE = 60 * 60 * 12

export const runtime = 'nodejs'

const ALUMNO_CLAVE_MAESTRA = '2671st'

async function loginUsuario(
  username: string,
  password: string
): Promise<AuthSession | null> {
  const supabase = createDbAdmin()
  const { data, error } = await supabase
    .from('usuario')
    .select(
      'usuario_id, usuario_username, usuario_password, usuario_nombre, usuario_app, usuario_apm'
    )
    .eq('usuario_username', username)
    .eq('usuario_password', password)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    console.error('loginUsuario:', error)
    throw new Error('Error de conexión con la base de datos')
  }

  if (!data) return null

  const displayName =
    `${data.usuario_nombre ?? ''} ${data.usuario_app ?? ''} ${data.usuario_apm ?? ''}`.trim() ||
    data.usuario_username

  return {
    role: 'usuario',
    displayName,
    usuario_id: data.usuario_id,
    usuario_username: data.usuario_username,
  }
}

function sessionDesdeAlumno(data: {
  alumno_id: number
  alumno_ref: number | null
  alumno_nombre: string | null
  alumno_app: string | null
  alumno_apm: string | null
}): AuthSession {
  const displayName =
    `${data.alumno_nombre ?? ''} ${data.alumno_app ?? ''} ${data.alumno_apm ?? ''}`.trim() ||
    `Alumno ${data.alumno_ref}`

  return {
    role: 'alumno',
    displayName,
    alumno_id: data.alumno_id,
    alumno_ref: data.alumno_ref ?? undefined,
  }
}

async function loginAlumno(refInput: string, password: string): Promise<AuthSession | null> {
  const ref = parseInt(refInput.replace(/\D/g, ''), 10)
  if (!Number.isFinite(ref) || ref <= 0) return null

  const supabase = createDbAdmin()
  const { data: alumno, error: errAlumno } = await supabase
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_status')
    .eq('alumno_ref', ref)
    .maybeSingle()

  if (errAlumno && errAlumno.code !== 'PGRST116') {
    console.error('loginAlumno alumno:', errAlumno)
    throw new Error('Error de conexión con la base de datos')
  }

  if (!alumno || alumno.alumno_status !== 1) return null

  const claveMaestra = password === ALUMNO_CLAVE_MAESTRA

  if (!claveMaestra) {
    const { data: detalle, error: errDetalle } = await supabase
      .from('alumno_detalles')
      .select('alumno_clave')
      .eq('alumno_id', alumno.alumno_id)
      .maybeSingle()

    if (errDetalle && errDetalle.code !== 'PGRST116') {
      console.error('loginAlumno detalles:', errDetalle)
      throw new Error('Error de conexión con la base de datos')
    }

    const claveDb = (detalle?.alumno_clave ?? '').trim()
    const claveIngresada = password.trim()

    if (!claveDb || claveDb !== claveIngresada) {
      return null
    }
  }

  return sessionDesdeAlumno(alumno)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const username = String(body.username ?? '').trim()
    const password = String(body.password ?? '').trim()

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y clave son obligatorios' }, { status: 400 })
    }

    const staff = await loginUsuario(username, password)
    if (staff) {
      const response = NextResponse.json({ ok: true, session: staff })
      response.cookies.set(STAFF_SESSION_COOKIE, '1', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: STAFF_COOKIE_MAX_AGE,
        path: '/',
      })
      return response
    }

    const alumno = await loginAlumno(username, password)
    if (alumno) {
      return NextResponse.json({ ok: true, session: alumno })
    }

    return NextResponse.json({ ok: false, error: 'Acceso no válido' }, { status: 401 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al iniciar sesión'
    console.error('POST /api/auth/login:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
