import { NextResponse } from 'next/server'
import { obtenerAlumnoPorId } from './alumnoDatosService'
import type { AlumnoRegistro } from './alumnoDatosService'

export type AlumnoAuthResult =
  | { ok: true; alumno: AlumnoRegistro }
  | { ok: false; response: NextResponse }

/**
 * Valida que el alumno exista y pueda usar portales (status 1 o 2).
 * La sesión del dashboard envía alumnoId desde AuthContext; aquí evitamos IDs inválidos.
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

  const status = Number(alumno.alumno_status)
  if (status !== 1 && status !== 2) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'El alumno no tiene acceso activo al portal.' },
        { status: 403 }
      ),
    }
  }

  return { ok: true, alumno }
}
