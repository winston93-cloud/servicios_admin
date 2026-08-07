import type { AppDatabaseClient } from '@/lib/dbTypes'
import {
  aplicarCoberturaTrasPagoAnual,
  CONCEPTO_PAGO_ANUAL,
} from '@/lib/pagoAnualService'
import { normalizarConceptoNo, parsearReferenciaPago } from '@/lib/pagoReferenciaColegiatura'

/**
 * Si la referencia es concepto 30 (Pago Anual), cubre las colegiaturas del plan en $0
 * y marca el registro alumno_pago_anual como pagado.
 */
export async function talvezAplicarCoberturaPagoAnual(
  db: AppDatabaseClient,
  referencia: string,
  opts?: { importe?: number; fechaPago?: string }
): Promise<void> {
  const parsed = parsearReferenciaPago(referencia)
  if (!parsed) return
  if (normalizarConceptoNo(parsed.conceptoNo) !== CONCEPTO_PAGO_ANUAL) return

  const refNum = parseInt(parsed.alumnoRef, 10)
  const { data: alumno, error } = await db
    .from('alumno')
    .select('alumno_id, alumno_ref, mes')
    .eq('alumno_ref', Number.isFinite(refNum) ? refNum : parsed.alumnoRef)
    .order('alumno_ciclo_escolar', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !alumno) {
    console.error('talvezAplicarCoberturaPagoAnual: alumno no encontrado', error?.message)
    return
  }

  const r = await aplicarCoberturaTrasPagoAnual(
    db,
    {
      alumno_id: alumno.alumno_id,
      alumno_ref: String(alumno.alumno_ref),
      mes: alumno.mes,
    },
    parsed.cicloEscolar,
    {
      fechaPago: opts?.fechaPago,
      importePagado: opts?.importe,
    }
  )

  if (!r.ok) {
    console.error('talvezAplicarCoberturaPagoAnual:', r.error)
  }
}
