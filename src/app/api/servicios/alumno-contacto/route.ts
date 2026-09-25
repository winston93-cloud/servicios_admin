import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  eliminarPersonaAutorizada,
  guardarPersonaAutorizada,
} from '@/lib/alumnoContactoService'

export const runtime = 'nodejs'

function metaRequest(request: Request) {
  const fwd = request.headers.get('x-forwarded-for')
  const ip = fwd?.split(',')[0]?.trim() || request.headers.get('x-real-ip')
  return {
    ip: ip || null,
    userAgent: request.headers.get('user-agent'),
  }
}

function actorFromSession(session: {
  usuario_id?: number
  usuario_username?: string
  displayName: string
}) {
  return {
    tipo: 'staff' as const,
    id: session.usuario_id != null ? String(session.usuario_id) : null,
    label: session.usuario_username?.trim() || session.displayName?.trim() || 'staff',
  }
}

/** 2026-09-25: alta/edición de persona autorizada (quién recoge) + historial. */
export async function POST(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json().catch(() => ({}))) as {
      alumnoId?: number
      contactoId?: number | null
      nombre?: string
      parentesco?: string
      telefonoCasa?: string
      celular?: string
    }

    const alumnoId = Number(body.alumnoId)
    if (!Number.isFinite(alumnoId) || alumnoId <= 0) {
      return NextResponse.json({ ok: false, error: 'alumnoId inválido' }, { status: 400 })
    }

    const meta = metaRequest(request)
    const db = createDbAdmin()
    const resultado = await guardarPersonaAutorizada(
      {
        alumnoId,
        contactoId:
          body.contactoId == null || !Number.isFinite(Number(body.contactoId))
            ? null
            : Number(body.contactoId),
        nombre: String(body.nombre ?? ''),
        parentesco: String(body.parentesco ?? ''),
        telefonoCasa: String(body.telefonoCasa ?? ''),
        celular: String(body.celular ?? ''),
      },
      {
        db,
        actor: actorFromSession(auth.session),
        origen: 'servicios-admin',
        ip: meta.ip,
        userAgent: meta.userAgent,
      }
    )

    if (!resultado.ok) {
      return NextResponse.json({ ok: false, error: resultado.mensaje }, { status: 422 })
    }

    return NextResponse.json({ ok: true, contactoId: resultado.contactoId })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al guardar contacto'
    console.error('POST /api/servicios/alumno-contacto:', e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/** 2026-09-25: baja de persona autorizada + historial. */
export async function DELETE(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response

  try {
    const url = new URL(request.url)
    const alumnoId = Number(url.searchParams.get('alumnoId'))
    const contactoId = Number(url.searchParams.get('contactoId'))
    if (!Number.isFinite(alumnoId) || alumnoId <= 0 || !Number.isFinite(contactoId) || contactoId <= 0) {
      return NextResponse.json(
        { ok: false, error: 'alumnoId y contactoId son obligatorios' },
        { status: 400 }
      )
    }

    const meta = metaRequest(request)
    const db = createDbAdmin()
    const resultado = await eliminarPersonaAutorizada(alumnoId, contactoId, {
      db,
      actor: actorFromSession(auth.session),
      origen: 'servicios-admin',
      ip: meta.ip,
      userAgent: meta.userAgent,
    })

    if (!resultado.ok) {
      return NextResponse.json({ ok: false, error: resultado.mensaje }, { status: 422 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al eliminar contacto'
    console.error('DELETE /api/servicios/alumno-contacto:', e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
