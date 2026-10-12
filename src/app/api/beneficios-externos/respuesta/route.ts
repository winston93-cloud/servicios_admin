import { NextResponse } from 'next/server'
import { sesionPortalDeRequest } from '@/lib/portalSesionFirmada'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  cicloBeneficiosExternos,
  esRefPruebaBeneficiosExternos,
  familiaVeBeneficiosExternos,
} from '@/lib/beneficiosExternos/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 2026-10-12 — Guarda la respuesta de la familia al cuestionario de Beneficios externos.
 * El alumno sale de la cookie firmada (nunca del cuerpo); una fila por alumno y ciclo.
 */
export async function POST(request: Request) {
  const sesion = sesionPortalDeRequest(request)
  const alumnoId = Number(sesion?.alumno_id) || 0
  if (sesion?.role !== 'alumno' || alumnoId <= 0) {
    return NextResponse.json({ error: 'Inicie sesión como alumno.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const aplico = body?.aplico
  if (typeof aplico !== 'boolean') {
    return NextResponse.json({ error: 'Respuesta incompleta.' }, { status: 400 })
  }
  const beneficio = aplico && (body?.beneficio === 'sep' || body?.beneficio === 'otra') ? body.beneficio : null
  if (aplico && !beneficio) {
    return NextResponse.json({ error: 'Indique a cuál beca aplicó.' }, { status: 400 })
  }
  const nombre =
    beneficio === 'otra' && typeof body?.beneficioNombre === 'string' ? body.beneficioNombre.trim().slice(0, 120) : ''
  const recibio = aplico && typeof body?.recibio === 'boolean' ? body.recibio : null

  try {
    const db = createDbAdmin()
    const { data: alumno, error: errAlumno } = await db
      .from('alumno')
      .select('alumno_ref, alumno_nivel')
      .eq('alumno_id', alumnoId)
      .maybeSingle()
    if (errAlumno) throw errAlumno

    const alumnoRef = Number(alumno?.alumno_ref ?? sesion.alumno_ref) || null
    if (!familiaVeBeneficiosExternos(alumnoRef)) {
      return NextResponse.json({ error: 'Esta sección todavía no está disponible.' }, { status: 403 })
    }

    const { error } = await db.from('beneficios_externos_respuesta').upsert(
      [
        {
          alumno_id: alumnoId,
          alumno_ref: alumnoRef,
          alumno_nivel: Number(alumno?.alumno_nivel) || null,
          ciclo_escolar: cicloBeneficiosExternos(),
          aplico,
          beneficio,
          beneficio_nombre: nombre || null,
          recibio,
          es_prueba: esRefPruebaBeneficiosExternos(alumnoRef),
          actualizado_en: new Date().toISOString(),
        },
      ],
      { onConflict: 'alumno_id,ciclo_escolar' }
    )
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('POST /api/beneficios-externos/respuesta:', e)
    return NextResponse.json({ error: 'No se pudo guardar su respuesta. Intente de nuevo.' }, { status: 500 })
  }
}
