import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from './alumnoDatosService'
import type { PagoDetalleRegistro } from './pagoColegiaturaService'
import { alumnoTienePagoSemiref } from './portalAdmisionesColegiatura'
import { cargarSolicitudInscripcion } from './portalInscripcionesSolicitudService'
import {
  resumenSeccionesFaltantes,
  solicitudFormularioCompleta,
} from './portalInscripcionesValidacion'

export type EstadoSolicitudCaptura = {
  completa: boolean
  /** Mensaje corto de secciones pendientes, o null si está completa. */
  faltantesResumen: string | null
}

/**
 * La solicitud solo cuenta como capturada si las 5 secciones pasan validación.
 * Ya no basta con `alumno_registro` o un CURP parcial en alumno_detalles.
 */
export async function evaluarSolicitudCapturada(
  supabase: AppDatabaseClient,
  alumno: AlumnoRegistro
): Promise<EstadoSolicitudCaptura> {
  try {
    const form = await cargarSolicitudInscripcion(supabase, alumno.alumno_id)
    const completa = solicitudFormularioCompleta(form)
    return {
      completa,
      faltantesResumen: completa ? null : resumenSeccionesFaltantes(form),
    }
  } catch (e) {
    console.error('evaluarSolicitudCapturada:', e)
    return {
      completa: false,
      faltantesResumen: 'No se pudo verificar la solicitud. Ábrela y completa las 5 secciones.',
    }
  }
}

/** Port de admisiones_solicitud_capturada (estricto: formulario completo). */
export async function solicitudCapturada(
  supabase: AppDatabaseClient,
  alumno: AlumnoRegistro
): Promise<boolean> {
  const estado = await evaluarSolicitudCapturada(supabase, alumno)
  return estado.completa
}

/** Port de admisiones_tiene_inscripcion_completa_pagada. */
export function inscripcionCompletaPagada(
  pagos: PagoDetalleRegistro[],
  alumnoRef: string | number,
  cen: number
): boolean {
  if (alumnoTienePagoSemiref(pagos, alumnoRef, '13', cen)) return true
  return (
    alumnoTienePagoSemiref(pagos, alumnoRef, '11', cen) &&
    alumnoTienePagoSemiref(pagos, alumnoRef, '12', cen)
  )
}

export function tieneDiferido1Pagado(
  pagos: PagoDetalleRegistro[],
  alumnoRef: string | number,
  cen: number
): boolean {
  return alumnoTienePagoSemiref(pagos, alumnoRef, '11', cen)
}
