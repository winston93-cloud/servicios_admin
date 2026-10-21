import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { emitirCodigoQrAcceso } from '@/lib/qrAccesoCodigo'
import {
  esStaffPreviewPanelPadres,
  PORTAL_AUTORIZADOS_PREVIEW_REFS,
  puedeUsarApiPortalAutorizados,
} from '@/lib/portalPadresPreview'
import { sesionPortalDeRequest } from '@/lib/portalSesionFirmada'
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

export async function GET(request: Request) {
  try {
    const session = sesionPortalDeRequest(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Tu sesión expiró. Vuelve a iniciar sesión.' },
        { status: 401 }
      )
    }
    if (!puedeUsarApiPortalAutorizados(session)) {
      return NextResponse.json(
        { error: 'Este QR todavía no está disponible para esta cuenta.' },
        { status: 403 }
      )
    }

    const url = new URL(request.url)
    const db = createDbAdmin()

    let alumno: AlumnoFila | null = null
    if (session.role === 'alumno') {
      alumno = await buscarAlumno(db, { alumnoId: Number(session.alumno_id) })
    } else if (esStaffPreviewPanelPadres(session)) {
      alumno = await buscarAlumno(db, {
        alumnoRef:
          url.searchParams.get('alumnoRef') || String(PORTAL_AUTORIZADOS_PREVIEW_REFS[0] ?? ''),
        alumnoId: Number(url.searchParams.get('alumnoId') || 0),
      })
    } else {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
    }

    if (!alumno?.alumno_ref) {
      return NextResponse.json({ error: 'Alumno no encontrado.' }, { status: 404 })
    }

    const alumnoRef = Number(alumno.alumno_ref)
    const codigo = await emitirCodigoQrAcceso(alumnoRef)
    const grupo = etiquetaGrupoEscolar(alumno.alumno_grupo)
    const grado = etiquetaGradoEscolar(alumno.alumno_nivel, alumno.alumno_grado)
    const nivel = etiquetaNivelEscolar(alumno.alumno_nivel)

    return NextResponse.json({
      ok: true,
      codigo,
      alumno: {
        alumnoId: alumno.alumno_id,
        alumnoRef,
        nombre: nombreCompleto(alumno),
        nivel,
        grado,
        grupo,
      },
    })
  } catch (e) {
    console.error('GET /api/portal-qr-acceso:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo emitir el QR.' },
      { status: 500 }
    )
  }
}
