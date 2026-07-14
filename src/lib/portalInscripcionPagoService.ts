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
import { resolverCicloPagoInscripcionPortal } from './portalInscripcionesCiclo'
import { inscripcionCompletaPagada, solicitudCapturada } from './portalInscripcionesSolicitud'
import { calcularReinscripcionDiferido } from './portalReinscripcionService'
import { obtenerCicloPorValor } from './ciclosEscolaresService'

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
  const solCompleta = await solicitudCapturada(supabase, alumno)

  // Reinscritos: ciclo destino y montos calendáricos (11 / 12 / 13 según ventanas).
  if (esReinscrito) {
    const calc = await calcularReinscripcionDiferido(supabase, alumno)
    if (calc) {
      const cicloReinscripcion =
        (await obtenerCicloPorValor(calc.cicloReinscripcion)) ?? ciclo
      const filas = calc.filaPendiente
        ? [...calc.filasPagadas, calc.filaPendiente]
        : calc.filasPagadas

      const tituloPago =
        calc.concepto === '13'
          ? 'Pago de inscripción'
          : calc.concepto === '12'
            ? 'Pago de reinscripción (2.º diferido)'
            : calc.concepto === '11'
              ? 'Pago de reinscripción (1.er diferido)'
              : 'Pago de reinscripción'

      return {
        ciclo: cicloReinscripcion,
        alumno,
        esReinscrito,
        tituloPago,
        gradoEtiqueta: calc.graduado
          ? 'Egresado'
          : etiquetaGradoEscolar(calc.nivelDestino, calc.gradoDestino),
        solicitudCompleta: solCompleta,
        inscripcionPagada: calc.completa,
        filas,
      }
    }
  }

  const cicloPago = await resolverCicloPagoInscripcionPortal(alumno, ciclo)
  const filas = await construirFilasInscripcionPortal(
    supabase,
    alumno,
    cicloPago,
    pagos,
    esReinscrito
  )

  return {
    ciclo: cicloPago,
    alumno,
    esReinscrito,
    tituloPago: esReinscrito ? 'Pago de reinscripción' : 'Pago de inscripción',
    gradoEtiqueta: etiquetaGradoEscolar(alumno.alumno_nivel, alumno.alumno_grado),
    solicitudCompleta: solCompleta,
    inscripcionPagada: inscripcionCompletaPagada(
      pagos,
      alumno.alumno_ref,
      cicloPago.valor
    ),
    filas,
  }
}
