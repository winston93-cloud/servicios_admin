import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from './alumnoDatosService'
import { formaIngresoPorDefecto } from './alumnoFormaIngreso'
import type { CicloEscolarRegistro } from './ciclosEscolaresService'
import { etiquetaGradoEscolar } from './gradoEscolar'
import type { PagoDetalleRegistro } from './pagoColegiaturaService'
import {
  construirFilasInscripcionPortal,
  type FilaMatrizPortal,
} from './portalPagosMatrizService'
import { tienePagoConcepto } from './portalInscripcionesService'
import { calcularReinscripcionDiferido } from './portalReinscripcionService'
import { obtenerCicloPorValor } from './ciclosEscolaresService'

function solicitudCompleta(alumno: AlumnoRegistro): boolean {
  if (alumno.alumno_registro) return true
  if (formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso) === 1 && alumno.alumno_status === 1) {
    return true
  }
  return false
}

function inscripcionPagada(
  pagos: PagoDetalleRegistro[],
  alumno: AlumnoRegistro,
  ciclo: number,
  esReinscrito: boolean
): boolean {
  if (tienePagoConcepto(pagos, alumno.alumno_ref, '13', ciclo)) return true
  if (esReinscrito && tienePagoConcepto(pagos, alumno.alumno_ref, '12', ciclo)) return true
  if (esReinscrito && tienePagoConcepto(pagos, alumno.alumno_ref, '11', ciclo)) return true
  return false
}

export interface VistaPagoInscripcionPortal {
  ciclo: CicloEscolarRegistro
  alumno: AlumnoRegistro
  esReinscrito: boolean
  tituloPago: string
  gradoEtiqueta: string
  solicitudCompleta: boolean
  inscripcionPagada: boolean
  filas: FilaMatrizPortal[]
}

export async function construirVistaPagoInscripcion(
  supabase: AppDatabaseClient,
  alumno: AlumnoRegistro,
  ciclo: CicloEscolarRegistro,
  pagos: PagoDetalleRegistro[]
): Promise<VistaPagoInscripcionPortal> {
  const esReinscrito = formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso) === 0

  // Reinscritos: la reinscripción es para el ciclo SIGUIENTE (cen = alu_ce + 1) y se
  // cobra por diferidos (concepto 11 → 12), igual que en el sistema de admisiones.
  if (esReinscrito) {
    const calc = await calcularReinscripcionDiferido(supabase, alumno)
    if (calc) {
      const cicloReinscripcion =
        (await obtenerCicloPorValor(calc.cicloReinscripcion)) ?? ciclo
      const filas = calc.filaPendiente
        ? [...calc.filasPagadas, calc.filaPendiente]
        : calc.filasPagadas

      return {
        ciclo: cicloReinscripcion,
        alumno,
        esReinscrito,
        tituloPago: 'Pago de reinscripción',
        gradoEtiqueta: etiquetaGradoEscolar(alumno.alumno_nivel, alumno.alumno_grado),
        solicitudCompleta: solicitudCompleta(alumno),
        inscripcionPagada: calc.completa,
        filas,
      }
    }
  }

  const filas = await construirFilasInscripcionPortal(
    supabase,
    alumno,
    ciclo,
    pagos,
    esReinscrito
  )

  return {
    ciclo,
    alumno,
    esReinscrito,
    tituloPago: esReinscrito ? 'Pago de reinscripción' : 'Pago de inscripción',
    gradoEtiqueta: etiquetaGradoEscolar(alumno.alumno_nivel, alumno.alumno_grado),
    solicitudCompleta: solicitudCompleta(alumno),
    inscripcionPagada: inscripcionPagada(pagos, alumno, ciclo.valor, esReinscrito),
    filas,
  }
}
