/**
 * Genera la carta de aceptación de beca (PDF) para preview admin / integraciones.
 * POST { nivel, datos } + Authorization: Bearer BECAS_CARTA_PREVIEW_SECRET
 */
import { NextRequest, NextResponse } from 'next/server'
import { crearCartaBecaPdf } from '@/app/firma-electronica/lib/crearCartaBecaPdf'
import type { DatosCartaBeca } from '@/app/firma-electronica/lib/datosPruebaCartas'
import type { NivelFirma } from '@/app/firma-electronica/lib/plantillasNivel'
import { PLANTILLAS_NIVEL } from '@/app/firma-electronica/lib/plantillasNivel'

const NIVELES = new Set(PLANTILLAS_NIVEL.map((p) => p.id))

function resolveAssetsBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, '')}`
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`
  }
  return 'http://localhost:3000'
}

function autorizado(req: NextRequest): boolean {
  const secret = process.env.BECAS_CARTA_PREVIEW_SECRET?.trim()
  if (!secret) return false
  const header =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
    req.headers.get('x-becas-carta-secret')?.trim() ||
    ''
  return header.length > 0 && header === secret
}

export async function POST(request: NextRequest) {
  try {
    if (!autorizado(request)) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const nivel = String(body.nivel || '').trim() as NivelFirma
    if (!NIVELES.has(nivel)) {
      return NextResponse.json({ error: 'Nivel inválido.' }, { status: 400 })
    }

    const datos = (body.datos ?? {}) as Partial<DatosCartaBeca>
    if (!String(datos.alumnoNombre || '').trim()) {
      return NextResponse.json(
        { error: 'Falta nombre del alumno.' },
        { status: 400 }
      )
    }

    const { bytes } = await crearCartaBecaPdf(nivel, datos, {
      assetsBaseUrl: resolveAssetsBaseUrl(),
    })

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="carta-aceptacion-beca.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al generar carta PDF.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
