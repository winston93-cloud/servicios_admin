import { NextResponse } from 'next/server'
import { cookieBoletasDesdeHeader } from '@/lib/boletasAuth'
import { parsePortalSessionHeader } from '@/lib/insforgeDbProxyShared'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { TeError, descargar, nivelDeKey, nivelesPermitidos, resolverNivel, subirArchivoDirectora } from '@/lib/teamEnglish/teService'
import type { TeNivel } from '@/lib/teamEnglish/teTypes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    await subirArchivoDirectora(nivel, form, quien)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return responderError(e, 'POST /api/team-english/archivo:')
  }
}

/** Directora (header de sesión) ve archivos de sus niveles; la teacher (cookie) solo sus planeaciones y constancias. */
export async function GET(request: Request) {
  try {
    const key = new URL(request.url).searchParams.get('key') ?? ''
    const info = nivelDeKey(key)
    if (!info) throw new TeError('Archivo no válido.', 400)

    const session = parsePortalSessionHeader(request.headers.get('x-portal-session'))
    let permitido = false
    if (session?.role === 'usuario') {
      permitido = nivelesPermitidos(session.usuario_id).includes(info.nivel as TeNivel)
    } else {
      const teacher = cookieBoletasDesdeHeader(request.headers.get('cookie'))
      permitido =
        teacher?.role === 'maestro' && teacher.id === info.maestroId && (info.tipo === 'planeacion' || info.tipo === 'constancia')
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
