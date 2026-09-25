import { NextResponse } from 'next/server'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  listarContactoAuditoriaPorAlumno,
  resumenEventoContactoAuditoria,
  insertarBaselineContactoAuditoria,
} from '@/lib/alumnoContactoAuditoriaService'

export const runtime = 'nodejs'

/** 2026-09-25: timeline de historial de contactos por alumno. */
export async function GET(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response

  try {
    const url = new URL(request.url)
    const alumnoId = Number(url.searchParams.get('alumnoId'))
    const filtro = String(url.searchParams.get('filtro') ?? '').trim()
    if (!Number.isFinite(alumnoId) || alumnoId <= 0) {
      return NextResponse.json({ ok: false, error: 'alumnoId inválido' }, { status: 400 })
    }

    const db = createDbAdmin()
    let eventos = await listarContactoAuditoriaPorAlumno(db, alumnoId, { limit: 250 })

    if (filtro === 'comunicados') {
      eventos = eventos.filter(
        (e) => e.accion === 'familiar.recibir_email' || e.accion.includes('familiar')
      )
    } else if (filtro === 'familiar') {
      eventos = eventos.filter((e) => e.accion.startsWith('familiar.'))
    } else if (filtro === 'emergencia') {
      eventos = eventos.filter((e) => {
        if (!e.accion.startsWith('contacto.')) return false
        const tipo = Number(
          (e.detalle as { contacto_tipo?: number })?.contacto_tipo ??
            (e.detalle as { after?: { contacto_tipo?: number } })?.after?.contacto_tipo ??
            0
        )
        return tipo === 1
      })
    } else if (filtro === 'autorizados') {
      eventos = eventos.filter((e) => {
        if (!e.accion.startsWith('contacto.')) return false
        const tipo = Number(
          (e.detalle as { contacto_tipo?: number })?.contacto_tipo ??
            (e.detalle as { after?: { contacto_tipo?: number } })?.after?.contacto_tipo ??
            0
        )
        return tipo === 2
      })
    }

    return NextResponse.json({
      ok: true,
      eventos: eventos.map((e) => ({
        ...e,
        resumen: resumenEventoContactoAuditoria(e),
      })),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al listar historial'
    console.error('GET /api/servicios/alumno-contacto-auditoria:', e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/** 2026-09-25: baseline snapshot (sistema) — solo staff; opcional alumnoId. */
export async function POST(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json().catch(() => ({}))) as {
      alumnoId?: number
      confirmar?: boolean
    }
    if (!body.confirmar) {
      return NextResponse.json(
        { ok: false, error: 'Envía confirmar: true para ejecutar baseline' },
        { status: 400 }
      )
    }

    const alumnoId =
      body.alumnoId != null && Number.isFinite(Number(body.alumnoId))
        ? Number(body.alumnoId)
        : undefined

    const db = createDbAdmin()
    const r = await insertarBaselineContactoAuditoria(db, { alumnoId })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error en baseline'
    console.error('POST /api/servicios/alumno-contacto-auditoria:', e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
