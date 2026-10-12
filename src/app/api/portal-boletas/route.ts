import { NextResponse } from 'next/server'
import { obtenerCicloEscolarActual, resolverCicloEscolarSistemaValor } from '@/lib/ciclosEscolaresService'
import { sesionDeAlumnoOPersonal, validarAlumnoPortal } from '@/lib/portalApiAlumnoAuth'
import {
  ETIQUETA_MODULO_PAPA,
  listarPublicaciones,
  modulosDeNivel,
  videoPortalBoletas,
} from '@/lib/boletasPortal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SIN_CACHE = { 'Cache-Control': 'private, no-store' }

/** Boletas del ciclo actual que la escuela ya publicó para este alumno. */
export async function GET(request: Request) {
  const alumnoId = Number(new URL(request.url).searchParams.get('alumnoId'))
  const sinSesion = sesionDeAlumnoOPersonal(request, alumnoId)
  if (sinSesion) return sinSesion
  const auth = await validarAlumnoPortal(alumnoId)
  if (!auth.ok) return auth.response

  try {
    const valor = await resolverCicloEscolarSistemaValor()
    const actual = await obtenerCicloEscolarActual()
    const nombre = actual?.valor === valor ? actual.nombre : null
    const modulos = modulosDeNivel(Number(auth.alumno.alumno_nivel))
    const [publicaciones, videoUrl] = await Promise.all([
      listarPublicaciones(valor, modulos),
      videoPortalBoletas(valor),
    ])

    const trimestres = [1, 2, 3].map((t) => ({
      trimestre: t,
      boletas: modulos
        .filter((m) => publicaciones.some((p) => p.modulo === m && p.trimestre === t))
        .map((m) => ({ modulo: m, etiqueta: ETIQUETA_MODULO_PAPA[m] })),
    }))

    return NextResponse.json(
      {
        alumno: {
          nombre: [auth.alumno.alumno_nombre, auth.alumno.alumno_app, auth.alumno.alumno_apm]
            .map((x) => String(x ?? '').trim())
            .filter(Boolean)
            .join(' '),
          nivel: Number(auth.alumno.alumno_nivel),
        },
        ciclo: { valor, nombre },
        aplica: modulos.length > 0,
        trimestres,
        videoUrl,
      },
      { headers: SIN_CACHE }
    )
  } catch (e) {
    console.error('portal-boletas:', e)
    return NextResponse.json(
      { error: 'No se pudieron consultar las boletas. Intenta más tarde.' },
      { status: 500, headers: SIN_CACHE }
    )
  }
}
