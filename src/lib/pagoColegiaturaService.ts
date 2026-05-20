import { supabase } from './supabase'
import {
  normalizarConceptoNo,
  parsearReferenciaPago,
  referenciaCoincideCiclo,
} from './pagoReferenciaColegiatura'

export interface ConceptoBoucher {
  concepto_id: number
  concepto_no: string
  concepto_clase: string
  alumno_nivel: number
  concepto_tipo: number
  concepto_descuento: number
}

export interface PagoDetalleRegistro {
  pago_id: number
  alumno_id: number | null
  pago_nombre: string | null
  pago_referencia: string | null
  pago_importe: number
  pago_recargo: number
  pago_forma: string | null
  pago_folio: string | null
  pago_fecha: string | null
  pago_hora: string | null
  pago_emisora: string | null
  pago_cancelado: number
  pago_registro: string | null
}

export type EstatusVisualPago = 'normal' | 'cancelado' | 'devolucion' | 'manual'

const SELECT_PAGO =
  'pago_id, alumno_id, pago_nombre, pago_referencia, pago_importe, pago_recargo, pago_forma, pago_folio, pago_fecha, pago_hora, pago_emisora, pago_cancelado, pago_registro'

export function estatusVisualPago(pago_cancelado: number): EstatusVisualPago {
  switch (pago_cancelado) {
    case 1:
      return 'cancelado'
    case 2:
      return 'devolucion'
    case 3:
      return 'manual'
    default:
      return 'normal'
  }
}

export async function listarConceptosBoucher(): Promise<ConceptoBoucher[]> {
  const { data, error } = await supabase
    .from('concepto_boucher')
    .select('concepto_id, concepto_no, concepto_clase, alumno_nivel, concepto_tipo, concepto_descuento')
    .order('concepto_no', { ascending: true })

  if (error) {
    console.error('Error al cargar concepto_boucher:', error)
    return []
  }
  return (data ?? []) as ConceptoBoucher[]
}

export async function obtenerUltimaActualizacionPagos(): Promise<string | null> {
  const { data, error } = await supabase
    .from('pago_detalle')
    .select('pago_actualizacion')
    .order('pago_actualizacion', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.pago_actualizacion) return null
  const d = new Date(data.pago_actualizacion as string)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

export async function listarPagosColegiaturaAlumno(
  alumnoId: number,
  cicloEscolar: number
): Promise<PagoDetalleRegistro[]> {
  const { data, error } = await supabase
    .from('pago_detalle')
    .select(SELECT_PAGO)
    .eq('alumno_id', alumnoId)
    .order('pago_fecha', { ascending: false })
    .order('pago_id', { ascending: false })
    .limit(500)

  if (error) {
    console.error('Error al listar pago_detalle:', error)
    return []
  }

  return ((data ?? []) as PagoDetalleRegistro[])
    .map((r) => ({
      ...r,
      pago_importe: Number(r.pago_importe),
      pago_recargo: Number(r.pago_recargo),
    }))
    .filter((r) => referenciaCoincideCiclo(r.pago_referencia, cicloEscolar))
}

export function conceptoClasePorReferencia(
  referencia: string | null | undefined,
  conceptos: ConceptoBoucher[]
): string {
  const p = parsearReferenciaPago(referencia)
  if (!p) return '—'
  const noRef = normalizarConceptoNo(p.conceptoNo)
  const hit = conceptos.find(
    (c) => normalizarConceptoNo(c.concepto_no) === noRef
  )
  return hit?.concepto_clase ?? `Concepto ${noRef}`
}

export function mapaConceptosPorNo(conceptos: ConceptoBoucher[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const c of conceptos) {
    m.set(normalizarConceptoNo(c.concepto_no), c.concepto_clase)
  }
  return m
}
