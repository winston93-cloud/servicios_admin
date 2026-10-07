import { NextResponse, after } from 'next/server'
import { leerCuerpo, requireAdminTalleres, responderErrorTalleres } from '@/lib/talleres/talleresApi'
import { revisarAlertasMinimoSeguro } from '@/lib/talleres/talleresAlertaMinimo'
import { idEntero } from '@/lib/talleres/talleresService'
import {
  actualizarNotasInscripcion,
  bajaInscripcion,
  buscarAlumnosTaller,
  conteoInscritos,
  eliminarInscripcion,
  inscribirAlumno,
  inscripcionesDeAlumno,
  inscripcionesDeGrupo,
  moverInscripcion,
  reactivarInscripcion,
} from '@/lib/talleres/talleresInscripcionService'
import { normalizarNiveles } from '@/lib/talleres/talleresTypes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * ?asignacion_id=N → alumnos del grupo (inscritos y bajas)
 * ?alumno_id=N     → grupos del alumno en el ciclo
 * ?q=texto&niveles=3,4 → búsqueda de alumnos activos
 */
export async function GET(request: Request) {
  const auth = await requireAdminTalleres(request)
  if (!auth.ok) return auth.response
  try {
    const url = new URL(request.url)
    const asignacionId = idEntero(url.searchParams.get('asignacion_id'))
    const alumnoId = idEntero(url.searchParams.get('alumno_id'))
    const q = url.searchParams.get('q')
    if (asignacionId > 0) return NextResponse.json({ inscripciones: await inscripcionesDeGrupo(asignacionId) })
    if (alumnoId > 0) return NextResponse.json(await inscripcionesDeAlumno(alumnoId))
    if (q != null) {
      const niveles = normalizarNiveles((url.searchParams.get('niveles') ?? '').split(','))
      return NextResponse.json({ alumnos: await buscarAlumnosTaller(q, niveles) })
    }
    return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 })
  } catch (e) {
    return responderErrorTalleres(e, 'GET /api/talleres/inscripciones:')
  }
}

/** { accion: 'inscribir' | 'mover' | 'reactivar' | 'notas', ... , forzar? } */
export async function POST(request: Request) {
  const auth = await requireAdminTalleres(request)
  if (!auth.ok) return auth.response
  try {
    const body = await leerCuerpo(request)
    const quien = auth.session.displayName || auth.session.usuario_username || null
    switch (body.accion) {
      case 'inscribir': await inscribirAlumno(body, quien); break
      case 'mover': await moverInscripcion(body, quien); break
      case 'reactivar': await reactivarInscripcion(body, quien); break
      case 'notas': await actualizarNotasInscripcion(body); break
      default: return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 })
    }
    after(revisarAlertasMinimoSeguro)
    return NextResponse.json({ ok: true, conteos: await conteoInscritos() })
  } catch (e) {
    return responderErrorTalleres(e, 'POST /api/talleres/inscripciones:')
  }
}

/** ?id=N&modo=baja|eliminar&motivo=… */
export async function DELETE(request: Request) {
  const auth = await requireAdminTalleres(request)
  if (!auth.ok) return auth.response
  try {
    const url = new URL(request.url)
    const id = idEntero(url.searchParams.get('id'))
    const modo = url.searchParams.get('modo')
    if (!id || (modo !== 'baja' && modo !== 'eliminar')) {
      return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 })
    }
    if (modo === 'baja') await bajaInscripcion(id, url.searchParams.get('motivo'))
    else await eliminarInscripcion(id)
    after(revisarAlertasMinimoSeguro)
    return NextResponse.json({ ok: true, conteos: await conteoInscritos() })
  } catch (e) {
    return responderErrorTalleres(e, 'DELETE /api/talleres/inscripciones:')
  }
}
