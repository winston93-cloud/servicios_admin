import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from './alumnoDatosService'
import { formaIngresoPorDefecto } from './alumnoFormaIngreso'
import { getDigVerif, referenciaSemibase } from './boucherCore'
import { CONCEPTO_MES } from './colegiaturaPrecioReglas'
import { normalizarConceptoNo, parsearReferenciaPago } from './pagoReferenciaColegiatura'
import { slotsColegiaturaPortal } from './portalPagosCandados'

/** Orden ago→jul del ciclo escolar. */
const ORDEN_MES_CICLO = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7] as const

export const FORMA_PAGO_PREVIOS_INGRESO = 'Ingreso mid-ciclo'
const NOMBRE_PAGO_PREVIOS = 'Colegiatura previa al ingreso (importe 0)'

function indiceMesCiclo(mes: number): number {
  return ORDEN_MES_CICLO.indexOf(mes as (typeof ORDEN_MES_CICLO)[number])
}

function mesDesdeAlta(alumnoAlta: string | null | undefined): number | null {
  const s = String(alumnoAlta ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const mes = Number(s.slice(5, 7))
  if (!Number.isFinite(mes) || mes < 1 || mes > 12) return null
  return mes
}

/**
 * Conceptos de colegiatura anteriores al mes de ingreso.
 * Excluye siempre la cuota de inicio de curso (00): sí se cobra.
 * Ej. ingreso en diciembre → 01, 02, 03 (sep–nov).
 */
export function conceptosColegiaturaPreviosAlIngreso(
  mesIngreso: number,
  planMeses: 1 | 2
): string[] {
  const idxIngreso = indiceMesCiclo(mesIngreso)
  if (idxIngreso < 0) return []

  const out: string[] = []
  for (const slot of slotsColegiaturaPortal(planMeses)) {
    for (const raw of slot) {
      const c = normalizarConceptoNo(raw)
      if (c === '00') continue
      const mesConcepto = CONCEPTO_MES[c]
      if (mesConcepto == null) continue
      const idx = indiceMesCiclo(mesConcepto)
      if (idx >= 0 && idx < idxIngreso) out.push(c)
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
 * Registra colegiaturas de meses anteriores al alta con importe 0
 * (no entró dinero a cuenta). Idempotente. No toca concepto 00.
 *
 * Solo para **nuevo ingreso** en el ciclo de su ficha. Los reinscritos
 * conservan `alumno_alta` antigua; no deben recibir ceros mid-ciclo.
 */
export async function asegurarColegiaturasPreviasIngresoCero(
  supabase: AppDatabaseClient,
  alumno: Pick<
    AlumnoRegistro,
    | 'alumno_id'
    | 'alumno_ref'
    | 'alumno_alta'
    | 'alumno_ciclo_escolar'
    | 'mes'
    | 'alumno_nuevo_ingreso'
  >,
  cicloValor: number,
  pagosExistentes: Array<{ pago_referencia?: string | null; pago_cancelado?: number | null }>
): Promise<{ insertados: string[] }> {
  if (formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso) !== 1) {
    return { insertados: [] }
  }
  if (Number(cicloValor) !== Number(alumno.alumno_ciclo_escolar)) {
    return { insertados: [] }
  }

  const mesIngreso = mesDesdeAlta(alumno.alumno_alta)
  if (mesIngreso == null) return { insertados: [] }

  const planMeses: 1 | 2 = Number(alumno.mes) === 2 ? 2 : 1
  const pendientes = conceptosColegiaturaPreviosAlIngreso(mesIngreso, planMeses).filter(
    (c) => !pagoVigenteConceptoCiclo(pagosExistentes, c, cicloValor)
  )

  if (pendientes.length === 0) return { insertados: [] }

  const fechaPago = altaIso
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
    const referencia = getDigVerif(0, referenciaSemibase(alumno.alumno_ref, concepto, cicloValor))
    const fila = {
      pago_id: pagoId,
      alumno_id: alumno.alumno_id,
      pago_nombre: NOMBRE_PAGO_PREVIOS,
      pago_referencia: referencia,
      pago_importe: 0,
      pago_recargo: 0,
      pago_forma: FORMA_PAGO_PREVIOS_INGRESO,
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
      console.error('asegurarColegiaturasPreviasIngresoCero:', concepto, error.message)
      pagoId = await siguientePagoId(supabase)
      const retry = await supabase.from('pago_detalle').insert({ ...fila, pago_id: pagoId })
      if (retry.error) {
        console.error('asegurarColegiaturasPreviasIngresoCero retry:', retry.error.message)
        continue
      }
    }

    insertados.push(concepto)
    pagoId += 1
  }

  return { insertados }
}
