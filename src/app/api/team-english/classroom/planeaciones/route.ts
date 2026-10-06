import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { TeError, equipo, resolverNivel } from '@/lib/teamEnglish/teService'
import { publicacionesClassroomTeacher } from '@/lib/teamEnglish/teClassroom'
import { lunesDe, sumarDias, type TeClassroomPlaneaciones } from '@/lib/teamEnglish/teTypes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CACHE_MS = 3 * 60_000
const cache = new Map<string, { en: number; r: TeClassroomPlaneaciones }>()

/** La planeación de una semana suele subirse la semana anterior: se busca desde el lunes previo hasta el domingo. */
export async function GET(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  try {
    const params = new URL(request.url).searchParams
    const nivel = resolverNivel(auth.session.usuario_id, params.get('nivel'))
    const semanaRaw = String(params.get('semana') ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(semanaRaw)) throw new TeError('Semana inválida.')
    const semana = lunesDe(semanaRaw)
    const clave = `${nivel}|${semana}`
    const previo = cache.get(clave)
    if (previo && Date.now() - previo.en < CACHE_MS && params.get('refrescar') !== '1') return NextResponse.json(previo.r)

    const desde = new Date(`${sumarDias(semana, -7)}T00:00:00-06:00`).toISOString()
    const hasta = new Date(`${sumarDias(semana, 7)}T00:00:00-06:00`).toISOString()
    const teachers = (await equipo(nivel)).filter((t) => t.activo)
    const r: TeClassroomPlaneaciones = {
      semana,
      teachers: await Promise.all(
        teachers.map(async (t) => {
          if (!t.email) return { maestro_id: t.maestro_id, error: 'Sin correo registrado.', items: [] }
          try {
            return { maestro_id: t.maestro_id, error: null, items: await publicacionesClassroomTeacher(t.email, desde, hasta) }
          } catch (e) {
            return { maestro_id: t.maestro_id, error: e instanceof Error ? e.message : 'Error de Classroom', items: [] }
          }
        }),
      ),
    }
    cache.set(clave, { en: Date.now(), r })
    return NextResponse.json(r)
  } catch (e) {
    if (e instanceof TeError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('GET /api/team-english/classroom/planeaciones:', e)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}
