import { NextRequest, NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { normalizarSesion, type AuthSession } from '@/lib/portalAuthService'
import { signSsiwHandoff, urlSsiwApp } from '@/lib/ssiwHandoff'

export const runtime = 'nodejs'

async function verificarSesionEnDb(session: AuthSession): Promise<boolean> {
  const db = createDbAdmin()
  if (session.role === 'alumno') {
    const { data, error } = await db
      .from('alumno')
      .select('alumno_id')
      .eq('alumno_id', session.alumno_id!)
      .eq('alumno_ref', session.alumno_ref!)
      .limit(1)
      .maybeSingle()
    if (error && error.code !== 'PGRST116') throw error
    return Boolean(data)
  }

  const { data, error } = await db
    .from('usuario')
    .select('usuario_id')
    .eq('usuario_id', session.usuario_id!)
    .eq('usuario_username', session.usuario_username!)
    .limit(1)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') throw error
  return Boolean(data)
}

/**
 * Emite URL de handoff SSO hacia SSIW según la sesión del portal.
 * Body: { session: AuthSession, ambiente?: 'salida' | 'entregas' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      session?: unknown
      ambiente?: string
    } | null

    const session = normalizarSesion(body?.session)
    if (!session) {
      return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
    }

    const ok = await verificarSesionEnDb(session)
    if (!ok) {
      return NextResponse.json({ error: 'Sesión no vigente' }, { status: 401 })
    }

    const ambiente = String(body?.ambiente ?? '').trim()
    if (session.role === 'alumno') {
      if (ambiente && ambiente !== 'salida') {
        return NextResponse.json({ error: 'Ambiente no permitido' }, { status: 403 })
      }
      const token = signSsiwHandoff({
        role: 'alumno',
        displayName: session.displayName,
        alumno_id: session.alumno_id,
        alumno_ref: session.alumno_ref,
      })
      const url = `${urlSsiwApp()}/auth/handoff?token=${encodeURIComponent(token)}`
      return NextResponse.json({ url, role: 'alumno' })
    }

    // Personal administrativo → ambiente entregas
    if (ambiente && ambiente !== 'entregas') {
      return NextResponse.json({ error: 'Ambiente no permitido' }, { status: 403 })
    }
    const token = signSsiwHandoff({
      role: 'maestra',
      displayName: session.displayName,
      usuario_id: session.usuario_id,
      usuario_username: session.usuario_username,
    })
    const url = `${urlSsiwApp()}/auth/handoff?token=${encodeURIComponent(token)}`
    return NextResponse.json({ url, role: 'maestra' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error en handoff SSIW'
    console.error('POST /api/ssiw/handoff:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
