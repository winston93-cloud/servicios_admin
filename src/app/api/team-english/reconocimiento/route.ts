import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { TeError, guardarReconocimiento, resolverNivel } from '@/lib/teamEnglish/teService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Directora: publica o edita un reconocimiento de la semana (multipart por la foto opcional). */
export async function POST(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  try {
    const form = await request.formData()
    const nivel = resolverNivel(auth.session.usuario_id, form.get('nivel'))
    const quien = auth.session.displayName?.trim() || auth.session.usuario_username || 'Dirección'
    await guardarReconocimiento(nivel, form, quien)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TeError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('POST /api/team-english/reconocimiento:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error inesperado' }, { status: 500 })
  }
}
