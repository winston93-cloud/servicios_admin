import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  eliminarPersonaAutorizada,
  guardarPersonaAutorizada,
  listarPersonasAutorizadas,
} from '@/lib/alumnoContactoService'
import {
  eliminarCasoEspecial,
  guardarCasoEspecial,
  hoyMexicoIso,
  listarCasosEspeciales,
} from '@/lib/alumnoCasoEspecialService'
import {
  esStaffPreviewPanelPadres,
  puedeUsarApiPortalAutorizados,
} from '@/lib/portalPadresPreview'
import { sesionPortalDeRequest } from '@/lib/portalSesionFirmada'
import type { AuthSession } from '@/lib/portalAuthService'
import type { AppDatabaseClient } from '@/lib/dbTypes'

export const runtime = 'nodejs'

const SELECT_ALUMNO =
  'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_status'

type AlumnoFila = {
  alumno_id: number
  alumno_ref: string | number
  alumno_nombre?: string | null
  alumno_app?: string | null
  alumno_apm?: string | null
}

function metaRequest(request: Request) {
  const fwd = request.headers.get('x-forwarded-for')
  const ip = fwd?.split(',')[0]?.trim() || request.headers.get('x-real-ip')
  return {
    ip: ip || null,
    userAgent: request.headers.get('user-agent'),
  }
}

function actorDesdeSesion(session: AuthSession) {
  if (session.role === 'usuario') {
    return {
      tipo: 'staff' as const,
      id: session.usuario_id != null ? String(session.usuario_id) : null,
      label: session.usuario_username?.trim() || session.displayName,
    }
  }
  return {
    tipo: 'portal' as const,
    id: session.alumno_id != null ? String(session.alumno_id) : null,
    label: session.displayName || `alumno ${session.alumno_ref ?? ''}`.trim(),
  }
}

function nombreCompleto(alumno: AlumnoFila): string {
  return `${alumno.alumno_app ?? ''} ${alumno.alumno_apm ?? ''} ${alumno.alumno_nombre ?? ''}`.trim()
}

async function buscarAlumno(
  db: AppDatabaseClient,
  opts: { alumnoId?: number; alumnoRef?: string | number }
): Promise<AlumnoFila | null> {
  const ref = opts.alumnoRef != null ? String(opts.alumnoRef).trim() : ''
  if (ref) {
    const refFiltro = /^\d+$/.test(ref) ? parseInt(ref, 10) : ref
    const { data, error } = await db
      .from('alumno')
      .select(SELECT_ALUMNO)
      .eq('alumno_ref', refFiltro)
      .order('alumno_ciclo_escolar', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as AlumnoFila | null) ?? null
  }

  const alumnoId = Number(opts.alumnoId)
  if (!Number.isFinite(alumnoId) || alumnoId <= 0) return null
  const { data, error } = await db
    .from('alumno')
    .select(SELECT_ALUMNO)
    .eq('alumno_id', alumnoId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as AlumnoFila | null) ?? null
}

function sesionORechazo(request: Request) {
  const session = sesionPortalDeRequest(request)
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Tu sesión expiró. Vuelve a iniciar sesión.' },
        { status: 401 }
      ),
    }
  }
  if (!puedeUsarApiPortalAutorizados(session)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Este módulo todavía no está disponible para familias.' },
        { status: 403 }
      ),
    }
  }
  return { ok: true as const, session }
}

async function alumnoAutorizado(
  request: Request,
  db: AppDatabaseClient,
  opts: { alumnoId?: number; alumnoRef?: string | number }
) {
  const auth = sesionORechazo(request)
  if (!auth.ok) return auth

  if (auth.session.role === 'alumno') {
    const propio = await buscarAlumno(db, { alumnoId: Number(auth.session.alumno_id) })
    if (!propio) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: 'Alumno no encontrado.' }, { status: 404 }),
      }
    }
    return { ok: true as const, session: auth.session, alumno: propio }
  }

  if (!esStaffPreviewPanelPadres(auth.session)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'No autorizado.' }, { status: 403 }),
    }
  }

  const alumno = await buscarAlumno(db, opts)
  if (!alumno) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Indica un número de control válido.' },
        { status: 404 }
      ),
    }
  }
  return { ok: true as const, session: auth.session, alumno }
}

async function payloadAlumno(db: AppDatabaseClient, alumno: AlumnoFila) {
  const [autorizados, casos] = await Promise.all([
    listarPersonasAutorizadas(alumno.alumno_id, db),
    listarCasosEspeciales(alumno.alumno_id, db),
  ])
  const hoy = hoyMexicoIso()
  const especiales = casos
    .filter((c) => String(c.fecha).slice(0, 10) >= hoy)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))

  return {
    ok: true,
    alumno: {
      alumnoId: alumno.alumno_id,
      alumnoRef: Number(alumno.alumno_ref),
      nombre: nombreCompleto(alumno),
    },
    autorizados,
    especiales,
  }
}

export async function GET(request: Request) {
  try {
    const db = createDbAdmin()
    const url = new URL(request.url)
    const resuelto = await alumnoAutorizado(request, db, {
      alumnoId: Number(url.searchParams.get('alumnoId') || 0),
      alumnoRef: url.searchParams.get('alumnoRef') || '',
    })
    if (!resuelto.ok) return resuelto.response
    return NextResponse.json(await payloadAlumno(db, resuelto.alumno))
  } catch (e) {
    console.error('GET /api/portal-autorizados:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo cargar.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      accion?: string
      alumnoId?: number
      alumnoRef?: string | number
      contactoId?: number | null
      nombre?: string
      parentesco?: string
      telefonoCasa?: string
      celular?: string
      telefono?: string
      fecha?: string
      personaNombre?: string
      motivo?: string
      casoId?: number
    }

    const db = createDbAdmin()
    const resuelto = await alumnoAutorizado(request, db, {
      alumnoId: body.alumnoId,
      alumnoRef: body.alumnoRef,
    })
    if (!resuelto.ok) return resuelto.response

    const { session, alumno } = resuelto
    const meta = metaRequest(request)
    const actor = actorDesdeSesion(session)
    const origen = session.role === 'usuario' ? 'portal-autorizados-preview' : 'portal-autorizados'

    if (body.accion === 'guardar-persona') {
      const resultado = await guardarPersonaAutorizada(
        {
          alumnoId: alumno.alumno_id,
          contactoId:
            body.contactoId == null || !Number.isFinite(Number(body.contactoId))
              ? null
              : Number(body.contactoId),
          nombre: String(body.nombre ?? ''),
          parentesco: String(body.parentesco ?? ''),
          telefonoCasa: String(body.telefonoCasa ?? ''),
          celular: String(body.celular ?? body.telefono ?? ''),
        },
        { db, actor, origen, ip: meta.ip, userAgent: meta.userAgent }
      )
      if (!resultado.ok) {
        return NextResponse.json({ ok: false, error: resultado.mensaje }, { status: 422 })
      }
      return NextResponse.json({
        ...(await payloadAlumno(db, alumno)),
        contactoId: resultado.contactoId,
      })
    }

    if (body.accion === 'eliminar-persona') {
      const contactoId = Number(body.contactoId)
      if (!Number.isFinite(contactoId) || contactoId <= 0) {
        return NextResponse.json({ error: 'contactoId inválido' }, { status: 400 })
      }
      const resultado = await eliminarPersonaAutorizada(alumno.alumno_id, contactoId, {
        db,
        actor,
        origen,
        ip: meta.ip,
        userAgent: meta.userAgent,
      })
      if (!resultado.ok) {
        return NextResponse.json({ ok: false, error: resultado.mensaje }, { status: 422 })
      }
      return NextResponse.json(await payloadAlumno(db, alumno))
    }

    if (body.accion === 'guardar-especial') {
      const resultado = await guardarCasoEspecial(
        {
          alumnoId: alumno.alumno_id,
          alumnoRef: Number(alumno.alumno_ref),
          fecha: String(body.fecha ?? ''),
          personaNombre: String(body.personaNombre ?? body.nombre ?? ''),
          parentesco: String(body.parentesco ?? ''),
          telefono: String(body.telefono ?? body.celular ?? ''),
          motivo: String(body.motivo ?? ''),
          contactoId:
            body.contactoId == null || !Number.isFinite(Number(body.contactoId))
              ? null
              : Number(body.contactoId),
          creadoPor: actor.label,
        },
        db
      )
      if (!resultado.ok) {
        return NextResponse.json({ ok: false, error: resultado.mensaje }, { status: 422 })
      }
      return NextResponse.json(await payloadAlumno(db, alumno))
    }

    if (body.accion === 'eliminar-especial') {
      const casoId = Number(body.casoId)
      if (!Number.isFinite(casoId) || casoId <= 0) {
        return NextResponse.json({ error: 'casoId inválido' }, { status: 400 })
      }
      const resultado = await eliminarCasoEspecial(alumno.alumno_id, casoId, db)
      if (!resultado.ok) {
        return NextResponse.json({ ok: false, error: resultado.mensaje }, { status: 422 })
      }
      return NextResponse.json(await payloadAlumno(db, alumno))
    }

    return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 })
  } catch (e) {
    console.error('POST /api/portal-autorizados:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo guardar.' },
      { status: 500 }
    )
  }
}
