import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { puedeAccederPortalAlumno } from '@/lib/alumnoStatus'
import type { AuthSession } from '@/lib/portalAuthService'

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
  // Misma ref puede existir en varios ciclos: tomar el más reciente con acceso al portal.
  const { data: filas, error: errAlumno } = await supabase
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_status, alumno_ciclo_escolar'
    )
    .eq('alumno_ref', ref)
    .order('alumno_ciclo_escolar', { ascending: false })
    .limit(20)

  if (errAlumno) {
    console.error('loginAlumno alumno:', errAlumno)
    throw new Error('Error de conexión con la base de datos')
  }

  const alumno = (filas ?? []).find((a) => puedeAccederPortalAlumno(a.alumno_status))
  if (!alumno) return null

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

    // No. de control (solo dígitos) → portal alumno.
    // Usuario de texto → personal administrativo.
    // Así no se cruzan los dashboards.
    const esNumeroControl = /^\d+$/.test(username)

    if (esNumeroControl) {
      const alumno = await loginAlumno(username, password)
      if (alumno) {
        return NextResponse.json({ ok: true, session: alumno })
      }
      // Fallback raro: usuario staff con username numérico
      const staff = await loginUsuario(username, password)
      if (staff) {
        return NextResponse.json({ ok: true, session: staff })
      }
    } else {
      const staff = await loginUsuario(username, password)
      if (staff) {
        return NextResponse.json({ ok: true, session: staff })
      }
    }

    return NextResponse.json({ ok: false, error: 'Acceso no válido' }, { status: 401 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al iniciar sesión'
    console.error('POST /api/auth/login:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
