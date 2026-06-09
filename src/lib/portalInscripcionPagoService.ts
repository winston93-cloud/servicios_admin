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
