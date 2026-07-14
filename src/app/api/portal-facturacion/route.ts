import { NextResponse } from 'next/server'
import { obtenerAlumnoPorId } from '@/lib/alumnoDatosService'
import {
  guardarDatosFacturacion,
  obtenerDatosFacturacionPorRef,
} from '@/lib/datosFacturacionService'
import type { DatosFacturacionFormulario } from '@/lib/datosFacturacionTypes'
import { createDbAdmin } from '@/lib/insforgeAdmin'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const alumnoId = Number(new URL(request.url).searchParams.get('alumnoId'))
    if (!alumnoId) {
      return NextResponse.json({ error: 'alumnoId es obligatorio' }, { status: 400 })
    }

    const alumno = await obtenerAlumnoPorId(alumnoId)
    if (!alumno?.alumno_ref) {
      return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 })
    }

    const alumnoRef = Number(alumno.alumno_ref)
    const db = createDbAdmin()
    const datos = await obtenerDatosFacturacionPorRef(db, alumnoRef)

    const nombreAlumno =
      `${alumno.alumno_app ?? ''} ${alumno.alumno_apm ?? ''} ${alumno.alumno_nombre ?? ''}`.trim() ||
      null

    return NextResponse.json({
      ok: true,
      alumnoRef,
      nombreAlumno,
      datos,
      existeAlta: Boolean(datos),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar datos fiscales'
    console.error('portal-facturacion GET:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const alumnoId = Number(body.alumnoId)
    const formulario = body.formulario as DatosFacturacionFormulario

    if (!alumnoId || !formulario) {
      return NextResponse.json(
        { error: 'alumnoId y formulario son obligatorios' },
        { status: 400 }
      )
    }

    const alumno = await obtenerAlumnoPorId(alumnoId)
    if (!alumno?.alumno_ref) {
      return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 })
    }

    const alumnoRef = Number(alumno.alumno_ref)
    const db = createDbAdmin()
    const resultado = await guardarDatosFacturacion(db, {
      ...formulario,
      alumno_ref: alumnoRef,
    })

    if (!resultado.ok) {
      return NextResponse.json({ ok: false, errores: resultado.errores }, { status: 422 })
    }

    return NextResponse.json({ ok: true, datos: resultado.datos })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al guardar datos fiscales'
    console.error('portal-facturacion POST:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
