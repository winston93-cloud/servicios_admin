import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { TeError, equipo, resolverNivel } from '@/lib/teamEnglish/teService'
import { diagnosticoPublicar } from '@/lib/teamEnglish/teClassroom'
import { planeacionAClassroom } from '@/lib/teamEnglish/tePlanClassroom'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Una semana completa puede ser ~100 publicaciones en varias clases. */
export const maxDuration = 300

/** Directora: programa la planeación aprobada en Classroom (por día y materia) o retira lo programado. */
export async function POST(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const nivel = resolverNivel(auth.session.usuario_id, body.nivel)
    if (body.accion === 'probar') {
      const teachers = (await equipo(nivel)).filter((t) => t.activo)
      const resultados = await Promise.all(
        teachers.map(async (t) => ({
          maestro_id: t.maestro_id,
          nombre: t.nombre,
          email: t.email,
          ...(t.email
            ? await diagnosticoPublicar(t.email, t.grupos)
            : { ok: false, error: 'Sin correo institucional en su perfil.', clases: [], temas_ejemplo: [], mapa: [] }),
        })),
      )
      return NextResponse.json({ teachers: resultados })
    }
    const id = Number(body.id)
    if (!Number.isInteger(id) || id <= 0) throw new TeError('Planeación no válida.')
    const accion = body.accion === 'retirar' ? 'retirar' : 'publicar'
    const quien = auth.session.displayName?.trim() || auth.session.usuario_username || 'Dirección'
    return NextResponse.json(await planeacionAClassroom(nivel, id, accion, quien))
  } catch (e) {
    if (e instanceof TeError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('POST /api/team-english/classroom/publicar:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error inesperado' }, { status: 500 })
  }
}
