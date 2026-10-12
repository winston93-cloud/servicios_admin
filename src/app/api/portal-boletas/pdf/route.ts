import { NextResponse } from 'next/server'
import { resolverCicloEscolarSistemaValor } from '@/lib/ciclosEscolaresService'
import { sesionDeAlumnoOPersonal, validarAlumnoPortal } from '@/lib/portalApiAlumnoAuth'
import { pdfModulo } from '@/lib/boletasEmailNivel'
import { esModuloBoleta, estaPublicada, modulosDeNivel, trimestreValido } from '@/lib/boletasPortal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SIN_CACHE = { 'Cache-Control': 'private, no-store' }

/** PDF de la boleta para el papá: solo su hijo, su nivel, ciclo actual y trimestre publicado. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const alumnoId = Number(url.searchParams.get('alumnoId'))
  const modulo = url.searchParams.get('modulo')
  const trimestre = trimestreValido(url.searchParams.get('trimestre'))

  const sinSesion = sesionDeAlumnoOPersonal(request, alumnoId)
  if (sinSesion) return sinSesion
  const auth = await validarAlumnoPortal(alumnoId)
  if (!auth.ok) return auth.response

  if (!esModuloBoleta(modulo) || trimestre == null) {
    return NextResponse.json({ error: 'Boleta no válida.' }, { status: 400, headers: SIN_CACHE })
  }
  if (!modulosDeNivel(Number(auth.alumno.alumno_nivel)).includes(modulo)) {
    return NextResponse.json({ error: 'Boleta no disponible.' }, { status: 404, headers: SIN_CACHE })
  }

  try {
    const ciclo = await resolverCicloEscolarSistemaValor()
    if (!(await estaPublicada(ciclo, modulo, trimestre))) {
      return NextResponse.json(
        { error: 'Esta boleta todavía no está disponible.' },
        { status: 404, headers: SIN_CACHE }
      )
    }
    const pdf = await pdfModulo({ modulo, alumnoId, bimestre: trimestre, ciclo })
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        ...SIN_CACHE,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="boleta-t${trimestre}-${modulo}.pdf"`,
      },
    })
  } catch (e) {
    console.error('portal-boletas/pdf:', e)
    return NextResponse.json(
      { error: 'No se pudo generar la boleta. Intenta más tarde.' },
      { status: 500, headers: SIN_CACHE }
    )
  }
}
