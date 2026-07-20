import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from './alumnoDatosService'
import { alumnoTieneBecaCompletaActiva } from './alumnoBecaService'
import { getDigVerif, referenciaSemibase } from './boucherCore'
import { normalizarConceptoNo, parsearReferenciaPago } from './pagoReferenciaColegiatura'
import { slotsColegiaturaPortal } from './portalPagosCandados'

const FORMA_PAGO_BECA = 'Beca 100%'
const NOMBRE_PAGO_BECA = 'Colegiatura cubierta por beca 100% (importe 0)'

/** Conceptos que la beca Winston cubre (no cuota 00 ni material 16). */
function conceptosColegiaturaCubiertosPorBeca(planMeses: 1 | 2): string[] {
  const out: string[] = []
  for (const slot of slotsColegiaturaPortal(planMeses)) {
    for (const raw of slot) {
      const c = normalizarConceptoNo(raw)
      if (c === '00' || c === '16') continue
      out.push(c)
    }
  }
  return out
}

function pagoVigenteConceptoCiclo(
  pagos: Array<{ pago_referencia?: string | null; pago_cancelado?: number | null }>,
  conceptoNo: string,
  cicloValor: number
): boolean {
  const concepto = normalizarConceptoNo(conceptoNo)
  return pagos.some((p) => {
    const cancelado = Number(p.pago_cancelado)
    if (cancelado === 1 || cancelado === 2) return false
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) return false
    return (
      normalizarConceptoNo(parsed.conceptoNo) === concepto &&
      parsed.cicloEscolar === cicloValor
    )
  })
}

async function siguientePagoId(supabase: AppDatabaseClient): Promise<number> {
  const { data } = await supabase
    .from('pago_detalle')
    .select('pago_id')
    .order('pago_id', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (Number((data as { pago_id?: number } | null)?.pago_id) || 0) + 1
}

/**
 * Para becados al 100% en el ciclo: registra colegiaturas pendientes
 * (meses del plan) con importe 0, como cubiertas. Idempotente.
 * No toca cuota de inicio (00) ni material (16).
 */
export async function asegurarColegiaturasBecaCompletaCero(
  supabase: AppDatabaseClient,
  alumno: Pick<AlumnoRegistro, 'alumno_id' | 'alumno_ref' | 'mes'>,
  cicloValor: number,
  pagosExistentes: Array<{ pago_referencia?: string | null; pago_cancelado?: number | null }>
): Promise<{ insertados: string[]; becaCompleta: boolean }> {
  const becaCompleta = await alumnoTieneBecaCompletaActiva(
    supabase,
    alumno.alumno_id,
    cicloValor
  )
  if (!becaCompleta) return { insertados: [], becaCompleta: false }

  const planMeses: 1 | 2 = Number(alumno.mes) === 2 ? 2 : 1
  const pendientes = conceptosColegiaturaCubiertosPorBeca(planMeses).filter(
    (c) => !pagoVigenteConceptoCiclo(pagosExistentes, c, cicloValor)
  )

  if (pendientes.length === 0) return { insertados: [], becaCompleta: true }

  const fechaPago = new Date().toISOString().slice(0, 10)
  const ahora = new Date().toISOString()
  const hora = new Date().toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  const insertados: string[] = []
  let pagoId = await siguientePagoId(supabase)

  for (const concepto of pendientes) {
    const referencia = getDigVerif(
      0,
      referenciaSemibase(alumno.alumno_ref, concepto, cicloValor)
    )
    const fila = {
      pago_id: pagoId,
      alumno_id: alumno.alumno_id,
      pago_nombre: NOMBRE_PAGO_BECA,
      pago_referencia: referencia,
      pago_importe: 0,
      pago_recargo: 0,
      pago_forma: FORMA_PAGO_BECA,
      pago_folio: null,
      pago_fecha: fechaPago,
      pago_hora: hora,
      pago_emisora: 'S/E',
      pago_cancelado: 3,
      pago_registro: ahora,
      pago_actualizacion: ahora,
      facturo: '',
      fact: '',
    }

    const { error } = await supabase.from('pago_detalle').insert(fila)
    if (error) {
      console.error('asegurarColegiaturasBecaCompletaCero:', concepto, error.message)
      pagoId = await siguientePagoId(supabase)
      const retry = await supabase.from('pago_detalle').insert({ ...fila, pago_id: pagoId })
      if (retry.error) {
        console.error('asegurarColegiaturasBecaCompletaCero retry:', retry.error.message)
        continue
      }
    }

    insertados.push(concepto)
    pagoId += 1
  }

  return { insertados, becaCompleta: true }
}
