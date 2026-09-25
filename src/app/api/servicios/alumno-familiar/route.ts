import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { guardarDatosFamiliar } from '@/lib/alumnoFamiliarService'
import { TUTOR_ID_MADRE, TUTOR_ID_PADRE } from '@/lib/alumnoFamiliarTutor'

export const runtime = 'nodejs'

function metaRequest(request: Request) {
  const fwd = request.headers.get('x-forwarded-for')
  const ip = fwd?.split(',')[0]?.trim() || request.headers.get('x-real-ip')
  return {
    ip: ip || null,
    userAgent: request.headers.get('user-agent'),
  }
}

/** 2026-09-25: guardar mamá/papá con actor de sesión + historial. */
export async function POST(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json().catch(() => ({}))) as {
      alumnoId?: number
      familiarId?: number | null
      tutorId?: number
      apellidoPaterno?: string
      apellidoMaterno?: string
      nombre?: string
      email?: string
      recibirEmail?: number
      telefonoCasa?: string
      celular?: string
      telefonoTrabajo?: string
      curp?: string
    }

    const alumnoId = Number(body.alumnoId)
    const tutorId = Number(body.tutorId)
    if (!Number.isFinite(alumnoId) || alumnoId <= 0) {
      return NextResponse.json({ ok: false, error: 'alumnoId inválido' }, { status: 400 })
    }
    if (tutorId !== TUTOR_ID_MADRE && tutorId !== TUTOR_ID_PADRE) {
      return NextResponse.json({ ok: false, error: 'tutorId debe ser 1 (madre) o 2 (padre)' }, { status: 400 })
    }

    const meta = metaRequest(request)
    const db = createDbAdmin()
    const actorLabel =
      auth.session.usuario_username?.trim() ||
      auth.session.displayName?.trim() ||
      'staff'

    const resultado = await guardarDatosFamiliar(
      {
        alumnoId,
        familiarId:
          body.familiarId == null || !Number.isFinite(Number(body.familiarId))
            ? null
            : Number(body.familiarId),
        tutorId,
        apellidoPaterno: String(body.apellidoPaterno ?? ''),
        apellidoMaterno: String(body.apellidoMaterno ?? ''),
        nombre: String(body.nombre ?? ''),
        email: String(body.email ?? ''),
        recibirEmail: body.recibirEmail === 0 ? 0 : 1,
        telefonoCasa: String(body.telefonoCasa ?? ''),
        celular: String(body.celular ?? ''),
        telefonoTrabajo: String(body.telefonoTrabajo ?? ''),
        curp: String(body.curp ?? ''),
      },
      {
        db,
        actor: {
          tipo: 'staff',
          id: auth.session.usuario_id != null ? String(auth.session.usuario_id) : null,
          label: actorLabel,
        },
        origen: 'servicios-admin',
        ip: meta.ip,
        userAgent: meta.userAgent,
      }
    )

    if (!resultado.ok) {
      return NextResponse.json({ ok: false, error: resultado.mensaje }, { status: 422 })
    }

    return NextResponse.json({ ok: true, familiarId: resultado.familiarId })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al guardar familiar'
    console.error('POST /api/servicios/alumno-familiar:', e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
