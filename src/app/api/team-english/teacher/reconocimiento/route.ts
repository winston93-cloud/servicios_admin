import { NextResponse } from 'next/server'
import { TeError, equipoDeTeacher, marcarReconocimiento } from '@/lib/teamEnglish/teService'
import { requireSesionTeacher } from '@/lib/teamEnglish/teTeacherAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** La teacher vio un reconocimiento o reacciona. En vista previa (coording/laura/mario) no se guarda nada. */
export async function POST(request: Request) {
  try {
    const s = requireSesionTeacher(request)
    const body = (await request.json().catch(() => ({}))) as { id?: unknown; reaccion?: unknown }
    const id = Number(body.id)
    if (!Number.isInteger(id) || id <= 0) throw new TeError('Reconocimiento no válido.')
    if (s.simuladoPor) return NextResponse.json({ ok: true, simulado: true })
    const r = await equipoDeTeacher(s.id)
    if (!r) throw new TeError('Tu usuario no está en un equipo de inglés.', 403)
    const reaccion = 'reaccion' in body ? (body.reaccion == null ? null : String(body.reaccion)) : undefined
    await marcarReconocimiento(r.nivel, s.id, id, reaccion)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TeError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('POST /api/team-english/teacher/reconocimiento:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error inesperado' }, { status: 500 })
  }
}
