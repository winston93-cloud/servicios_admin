import type { AlumnoRegistro } from './alumnoDatosService'
import { formaIngresoPorDefecto } from './alumnoFormaIngreso'
import {
  proyectarReinscripcionAlumno,
  type ProyeccionReinscripcion,
} from './portalReinscripcionProyeccion'

/**
 * Documentos en admisiones:
 * - Nuevo ingreso: siempre.
 * - Reinscritos: solo cambio de nivel Kinder 3 → 1º primaria, o 6º → 1º secundaria.
 */
export function esTransicionDocumentosReinscrito(
  proy: Pick<ProyeccionReinscripcion, 'proyectaPromocion' | 'cambioNivel'> & {
    cicloOrigen?: number
  },
  alumno: Pick<AlumnoRegistro, 'alumno_nivel' | 'alumno_grado'>
): boolean {
  if (!proy.proyectaPromocion || !proy.cambioNivel) return false
  const nivel = Number(alumno.alumno_nivel) || 0
  const grado = Number(alumno.alumno_grado) || 0
  // Kinder 3 → Primaria 1
  if (nivel === 2 && grado === 3) return true
  // Primaria 6 → Secundaria 1
  if (nivel === 3 && grado === 6) return true
  return false
}

export function requiereDocumentosAdmision(
  alumno: Pick<AlumnoRegistro, 'alumno_nuevo_ingreso' | 'alumno_nivel' | 'alumno_grado' | 'alumno_ciclo_escolar'>
): boolean {
  if (formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso) === 1) return true
  const proy = proyectarReinscripcionAlumno(alumno)
  return esTransicionDocumentosReinscrito(proy, alumno)
}

/** Nivel/grado usados para requisitos y correo de control escolar. */
export function nivelGradoDocumentosAdmision(
  alumno: Pick<AlumnoRegistro, 'alumno_nuevo_ingreso' | 'alumno_nivel' | 'alumno_grado' | 'alumno_ciclo_escolar'>
): { nivel: number; grado: number } {
  if (formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso) === 1) {
    return {
      nivel: Number(alumno.alumno_nivel) || 0,
      grado: Number(alumno.alumno_grado) || 1,
    }
  }
  const proy = proyectarReinscripcionAlumno(alumno)
  return { nivel: proy.nivel, grado: proy.grado || 1 }
}
