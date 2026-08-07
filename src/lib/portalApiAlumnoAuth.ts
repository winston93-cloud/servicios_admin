import { NextResponse } from 'next/server'
import { obtenerAlumnoPorId } from './alumnoDatosService'
import type { AlumnoRegistro } from './alumnoDatosService'
import { puedeAccederPortalAlumno } from './alumnoStatus'
import { createSupabaseAdmin } from './supabaseAdmin'
import { alumnoTieneAdeudoEgresadoActivo } from './adeudosEgresadosService'

export type AlumnoAuthResult =
  | { ok: true; alumno: AlumnoRegistro }
  | { ok: false; response: NextResponse }

/**
 * Valida que el alumno exista y pueda usar portales (1, 2, 4 o 5),
 * o tenga acceso temporal de adeudos egresados (status 0 sin cambiar ficha).
 */
export async function validarAlumnoPortal(alumnoId: number): Promise<AlumnoAuthResult> {
  if (!Number.isFinite(alumnoId) || alumnoId <= 0) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'alumnoId es obligatorio' }, { status: 400 }),
    }
  }

  const alumno = await obtenerAlumnoPorId(alumnoId)
  if (!alumno) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 }),
    }
  }

  if (puedeAccederPortalAlumno(alumno.alumno_status)) {
    return { ok: true, alumno }
  }

  const supabase = createSupabaseAdmin()
  if (await alumnoTieneAdeudoEgresadoActivo(supabase, alumno.alumno_id)) {
    return { ok: true, alumno }
  }

  return {
    ok: false,
    response: NextResponse.json(
      { error: 'El alumno no tiene acceso activo al portal.' },
      { status: 403 }
    ),
  }
}
