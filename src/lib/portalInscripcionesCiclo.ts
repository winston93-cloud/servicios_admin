import type { AlumnoRegistro } from './alumnoDatosService'
import { formaIngresoPorDefecto } from './alumnoFormaIngreso'
import {
  obtenerCicloPorValor,
  type CicloEscolarRegistro,
} from './ciclosEscolaresService'

/**
 * Ciclo con el que se cobra / valida la inscripción en el portal.
 *
 * - Nuevo ingreso: el de la ficha del alumno (`alumno_ciclo_escolar`), no el
 *   marcado `es_actual` en `ciclos_escolares` (puede seguir en el ciclo en curso
 *   mientras ya hay NI del siguiente).
 * - Reinscrito: ciclo destino de reinscripción (`cicloReinscripcion`) o el
 *   sistema si aún no se calculó.
 */
export async function resolverCicloPagoInscripcionPortal(
  alumno: Pick<AlumnoRegistro, 'alumno_nuevo_ingreso' | 'alumno_ciclo_escolar'>,
  cicloSistema: CicloEscolarRegistro,
  cicloReinscripcion?: number | null
): Promise<CicloEscolarRegistro> {
  const esReinscrito = formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso) === 0
  const valor = esReinscrito
    ? Number(cicloReinscripcion) || cicloSistema.valor
    : Number(alumno.alumno_ciclo_escolar) || cicloSistema.valor

  if (valor === cicloSistema.valor) return cicloSistema
  return (await obtenerCicloPorValor(valor)) ?? { ...cicloSistema, valor }
}
