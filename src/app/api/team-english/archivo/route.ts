import { NextResponse } from 'next/server'
import { sesionPortalDeRequest } from '@/lib/portalSesionFirmada'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { TeError, descargar, equipoDeTeacher, nivelDeKey, nivelesPermitidos, resolverNivel, subirArchivoDirectora } from '@/lib/teamEnglish/teService'
import type { TeNivel } from '@/lib/teamEnglish/teTypes'
import { sesionTeacherDeRequest } from '@/lib/teamEnglish/teTeacherAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Leer una planeación en PDF con IA puede tardar ~20-40 s. */
export const maxDuration = 60

function responderError(e: unknown, ctx: string) {
  if (e instanceof TeError) return NextResponse.json({ error: e.message }, { status: e.status })
  console.error(ctx, e)
  return NextResponse.json({ error: e instanceof Error ? e.message : 'Error inesperado' }, { status: 500 })
}

export async function POST(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  try {
    const form = await request.formData()
    const nivel = resolverNivel(auth.session.usuario_id, form.get('nivel'))
    const quien = auth.session.displayName?.trim() || auth.session.usuario_username || 'Dirección'
    const r = await subirArchivoDirectora(nivel, form, quien)
    return NextResponse.json({ ok: true, ...(r ?? {}) })
  } catch (e) {
    return responderError(e, 'POST /api/team-english/archivo:')
  }
}

/** Directora (header de sesión) ve archivos de sus niveles; la teacher (cookie) solo sus planeaciones, constancias y cursos, más eventos y stickers de su nivel. */
export async function GET(request: Request) {
  try {
    const key = new URL(request.url).searchParams.get('key') ?? ''
    const info = nivelDeKey(key)
    if (!info) throw new TeError('Archivo no válido.', 400)

    const session = sesionPortalDeRequest(request)
    let permitido = false
    if (session?.role === 'usuario') {
      permitido = nivelesPermitidos(session.usuario_id).includes(info.nivel as TeNivel)
    } else {
      const teacher = sesionTeacherDeRequest(request)
      if (teacher && (info.tipo === 'evento' || info.tipo === 'sticker')) {
        permitido = (await equipoDeTeacher(teacher.id))?.nivel === info.nivel
      } else {
        permitido = !!teacher && teacher.id === info.maestroId && ['planeacion', 'constancia', 'curso'].includes(info.tipo)
      }
    }
    if (!permitido) throw new TeError('No autorizado.', 403)

    const { bytes, tipo } = await descargar(key)
    const nombre = key.split('/').pop()?.replace(/^\d+-/, '') || 'archivo'
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': tipo,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(nombre)}`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    return responderError(e, 'GET /api/team-english/archivo:')
  }
}
