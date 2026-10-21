import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  esStaffPreviewPanelPadres,
  puedeUsarApiPortalAutorizados,
} from '@/lib/portalPadresPreview'
import { sesionPortalDeRequest } from '@/lib/portalSesionFirmada'
import {
  agregarFechasEventuales,
  eliminarFechaEventual,
  listarRegistrosSalidaPie,
  toggleDiaPermanente,
} from '@/lib/registroSalidaPieService'
import { normalizarDiaSemana } from '@/lib/diasSemanaPie'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaGrupoEscolar } from '@/lib/grupoEscolar'
import type { AppDatabaseClient } from '@/lib/dbTypes'

export const runtime = 'nodejs'

const SELECT_ALUMNO =
  'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo'

type AlumnoFila = {
  alumno_id: number
  alumno_ref: string | number
  alumno_nombre?: string | null
  alumno_app?: string | null
  alumno_apm?: string | null
  alumno_nivel?: string | number | null
  alumno_grado?: string | number | null
  alumno_grupo?: string | number | null
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

function nombreCompleto(alumno: AlumnoFila): string {
  return `${alumno.alumno_app ?? ''} ${alumno.alumno_apm ?? ''} ${alumno.alumno_nombre ?? ''}`.trim()
}

async function payload(db: AppDatabaseClient, alumno: AlumnoFila) {
  const registros = await listarRegistrosSalidaPie(alumno.alumno_ref, db)
  return {
    ok: true,
    alumno: {
      alumnoId: alumno.alumno_id,
      alumnoRef: Number(alumno.alumno_ref),
      nombre: nombreCompleto(alumno),
      nivel: etiquetaNivelEscolar(alumno.alumno_nivel),
      grado: etiquetaGradoEscolar(alumno.alumno_nivel, alumno.alumno_grado),
      grupo: etiquetaGrupoEscolar(alumno.alumno_grupo),
    },
    registros,
  }
}

async function alumnoDeSesion(
  request: Request,
  db: AppDatabaseClient,
  opts: { alumnoId?: number; alumnoRef?: string | number }
) {
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

  if (session.role === 'alumno') {
    const alumno = await buscarAlumno(db, { alumnoId: Number(session.alumno_id) })
    if (!alumno) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: 'Alumno no encontrado.' }, { status: 404 }),
      }
    }
    return { ok: true as const, alumno }
  }

  if (!esStaffPreviewPanelPadres(session)) {
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
  return { ok: true as const, alumno }
}

export async function GET(request: Request) {
  try {
    const db = createDbAdmin()
    const url = new URL(request.url)
    const resuelto = await alumnoDeSesion(request, db, {
      alumnoId: Number(url.searchParams.get('alumnoId') || 0),
      alumnoRef: url.searchParams.get('alumnoRef') || '',
    })
    if (!resuelto.ok) return resuelto.response
    return NextResponse.json(await payload(db, resuelto.alumno))
  } catch (e) {
    console.error('GET /api/portal-salida-pie:', e)
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
      dia?: string
      fechas?: string[]
      registroId?: number
      fecha?: string
    }
    const db = createDbAdmin()
    const resuelto = await alumnoDeSesion(request, db, {
      alumnoId: body.alumnoId,
      alumnoRef: body.alumnoRef,
    })
    if (!resuelto.ok) return resuelto.response
    const { alumno } = resuelto
    const ref = alumno.alumno_ref

    if (body.accion === 'activar-dia' || body.accion === 'desactivar-dia') {
      const dia = normalizarDiaSemana(String(body.dia ?? ''))
      if (!dia) {
        return NextResponse.json({ error: 'Día inválido.' }, { status: 400 })
      }
      const resultado = await toggleDiaPermanente(
        ref,
        dia,
        body.accion === 'activar-dia',
        db
      )
      if (!resultado.ok) {
        return NextResponse.json({ error: resultado.mensaje }, { status: 422 })
      }
      return NextResponse.json(await payload(db, alumno))
    }

    if (body.accion === 'agregar-eventuales') {
      const resultado = await agregarFechasEventuales(ref, body.fechas ?? [], db)
      if (!resultado.ok) {
        return NextResponse.json({ error: resultado.mensaje }, { status: 422 })
      }
      return NextResponse.json(await payload(db, alumno))
    }

    if (body.accion === 'eliminar-fecha') {
      const registroId = Number(body.registroId)
      if (!Number.isFinite(registroId) || registroId <= 0) {
        return NextResponse.json({ error: 'registroId inválido.' }, { status: 400 })
      }
      const resultado = await eliminarFechaEventual(ref, registroId, String(body.fecha ?? ''), db)
      if (!resultado.ok) {
        return NextResponse.json({ error: resultado.mensaje }, { status: 422 })
      }
      return NextResponse.json(await payload(db, alumno))
    }

    return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 })
  } catch (e) {
    console.error('POST /api/portal-salida-pie:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo guardar.' },
      { status: 500 }
    )
  }
}
