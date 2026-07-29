import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from '@/lib/alumnoDatosService'
import { listarPagosColegiaturaAlumno } from '@/lib/pagoColegiaturaService'
import {
  evaluarSolicitudCapturada,
  inscripcionCompletaPagada,
} from '@/lib/portalInscripcionesSolicitud'
import { obtenerPortalInscripcionProgreso } from '@/lib/portalInscripcionProgreso'
import { cicloCierreLiquidado, cicloCierreValor } from '@/lib/portalCierreCicloAnterior'
import { formaIngresoPorDefecto } from '@/lib/alumnoFormaIngreso'
import { obtenerCicloEscolarActual } from '@/lib/ciclosEscolaresService'
import { cicloInscripcionDesdeTemporada } from '@/lib/ciclosEscolares'
import { obtenerPlanMesesCiclo } from '@/lib/portalPlanMesesCiclo'
import {
  normalizarConceptoNo,
  parsearReferenciaPago,
} from '@/lib/pagoReferenciaColegiatura'
import { slotsColegiaturaPortal } from '@/lib/portalPagosCandados'

export type ElegibilidadPlanColegiaturas =
  | { ok: true; motivo: 'proceso_completo' | 'ya_registrado' | 'ya_tiene_colegiaturas' }
  | { ok: false; error: string }

async function tieneColegiaturasCiclo(
  alumno: AlumnoRegistro,
  cicloValor: number
): Promise<boolean> {
  const pagos = await listarPagosColegiaturaAlumno(alumno.alumno_id, cicloValor)
  const conceptos = new Set(slotsColegiaturaPortal(2).flat().map((c) => normalizarConceptoNo(c)))
  return pagos.some((p) => {
    if (p.pago_cancelado === 1 || p.pago_cancelado === 2) return false
    if (!(Number(p.pago_importe) > 0)) return false
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed || parsed.cicloEscolar !== cicloValor) return false
    return conceptos.has(normalizarConceptoNo(parsed.conceptoNo))
  })
}

/**
 * El plan 10/11 del ciclo nuevo se registra al terminar la (re)inscripción
 * (solicitud + pago + reglamento + recibo). Si ya hay fila o colegiaturas
 * del ciclo, no se bloquea (no re-pedir).
 */
export async function elegibilidadParaRegistrarPlanColegiaturas(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  cicloColegiaturasValor: number
): Promise<ElegibilidadPlanColegiaturas> {
  if (!Number.isFinite(cicloColegiaturasValor) || cicloColegiaturasValor <= 0) {
    return { ok: false, error: 'Ciclo de colegiaturas inválido.' }
  }

  const yaRegistrado =
    (await obtenerPlanMesesCiclo(db, alumno.alumno_id, cicloColegiaturasValor)) != null
  if (yaRegistrado) return { ok: true, motivo: 'ya_registrado' }

  if (await tieneColegiaturasCiclo(alumno, cicloColegiaturasValor)) {
    return { ok: true, motivo: 'ya_tiene_colegiaturas' }
  }

  const sol = await evaluarSolicitudCapturada(db, alumno)
  if (!sol.completa) {
    return {
      ok: false,
      error:
        sol.faltantesResumen ||
        'Completa la solicitud de inscripción antes de elegir el plan de pagos.',
    }
  }

  const pagosCiclo = await listarPagosColegiaturaAlumno(
    alumno.alumno_id,
    cicloColegiaturasValor
  )
  if (!inscripcionCompletaPagada(pagosCiclo, alumno.alumno_ref, cicloColegiaturasValor)) {
    return {
      ok: false,
      error:
        'Debes completar el pago de inscripción/reinscripción antes de elegir el plan de colegiaturas.',
    }
  }

  const progreso = await obtenerPortalInscripcionProgreso(
    db,
    alumno.alumno_id,
    cicloColegiaturasValor
  )
  if (!progreso?.reglamento_visto) {
    return {
      ok: false,
      error:
        'Consulta el reglamento escolar (paso 02) antes de elegir el plan de colegiaturas.',
    }
  }
  if (!progreso?.recibo_final_visto) {
    return {
      ok: false,
      error:
        'Genera y consulta el recibo final antes de elegir el plan de colegiaturas.',
    }
  }

  const esReinscrito = formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso) === 0
  if (esReinscrito) {
    const cicloActual = await obtenerCicloEscolarActual()
    const cea = Number(cicloActual?.valor) || cicloColegiaturasValor
    const cicloCierre = cicloCierreValor(cicloInscripcionDesdeTemporada(cea))
    if (cicloCierre > 0) {
      const pagosCierre = await listarPagosColegiaturaAlumno(
        alumno.alumno_id,
        cicloCierre
      )
      const liquidado = await cicloCierreLiquidado(
        db,
        pagosCierre,
        alumno,
        cicloCierre
      )
      if (!liquidado) {
        return {
          ok: false,
          error:
            'Liquida las colegiaturas del ciclo anterior antes de elegir el plan del ciclo nuevo.',
        }
      }
    }
  }

  return { ok: true, motivo: 'proceso_completo' }
}
