import { supabase } from './supabase'
import {
  generarReferenciaPagoDesdePago,
  normalizarConceptoNo,
  parsearReferenciaPago,
  referenciaCoincideCiclo,
  compararConceptoNoAsc,
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
  facturo?: string | null
}

export type EstatusVisualPago = 'normal' | 'cancelado' | 'devolucion' | 'manual'

const SELECT_PAGO =
  'pago_id, alumno_id, pago_nombre, pago_referencia, pago_importe, pago_recargo, pago_forma, pago_folio, pago_fecha, pago_hora, pago_emisora, pago_cancelado, pago_registro, facturo'

export function etiquetaEstatusPago(pago_cancelado: number): string | null {
  switch (pago_cancelado) {
    case 1:
      return 'Es pago cancelado'
    case 2:
      return 'Es devolución'
    case 3:
      return 'Agregado manual'
    default:
      return null
  }
}

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
  const filas = (data ?? []) as ConceptoBoucher[]
  return filas.sort((a, b) => compararConceptoNoAsc(a.concepto_no, b.concepto_no))
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

export async function actualizarEstatusPagoColegiatura(
  pagoId: number,
  pagoCancelado: number
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('pago_detalle')
    .update({ pago_cancelado: pagoCancelado })
    .eq('pago_id', pagoId)

  if (error) {
    console.error('Error al actualizar pago_detalle:', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export function mapaConceptosPorNo(conceptos: ConceptoBoucher[]): Map<string, string> {
  const m = new Map<string, string>()
  const ordenados = [...conceptos].sort((a, b) =>
    compararConceptoNoAsc(a.concepto_no, b.concepto_no)
  )
  for (const c of ordenados) {
    m.set(normalizarConceptoNo(c.concepto_no), c.concepto_clase.trim())
  }
  return m
}

export const FORMAS_PAGO_COLEGIATURA = [
  'Efectivo',
  'PaymentClabe',
  'Openpay',
  'Comercio Electronico',
  'Ventanilla',
  'CargoCuentaCheques',
] as const

export type FormaPagoColegiatura = (typeof FORMAS_PAGO_COLEGIATURA)[number]

export interface CrearPagoColegiaturaManualPayload {
  alumnoId: number
  alumnoRef: string
  pagoNombre: string
  conceptoNo: string
  cicloEscolar: number
  importe: number
  recargo: number
  fechaPago: string
  formaPago: string
}

export type ResultadoCrearPagoColegiaturaManual =
  | { ok: true; pagoId: number; referencia: string }
  | { ok: false; mensaje: string }

async function obtenerSiguientePagoId(): Promise<number> {
  const { data, error } = await supabase
    .from('pago_detalle')
    .select('pago_id')
    .order('pago_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error al obtener siguiente pago_id:', error)
    return 0
  }

  return (data?.pago_id ?? 0) + 1
}

function esErrorClaveDuplicada(error: { code?: string; message?: string }): boolean {
  return error.code === '23505' || (error.message?.includes('duplicate key') ?? false)
}

export async function crearPagoColegiaturaManual(
  payload: CrearPagoColegiaturaManualPayload
): Promise<ResultadoCrearPagoColegiaturaManual> {
  const importe = Math.round(payload.importe * 100) / 100
  const recargo = Math.round(payload.recargo * 100) / 100

  if (!Number.isFinite(importe) || !Number.isFinite(recargo) || importe < 0 || recargo < 0) {
    return { ok: false, mensaje: 'Importe y recargos deben ser números válidos.' }
  }

  if (importe + recargo <= 0) {
    return { ok: false, mensaje: 'El monto total debe ser mayor a cero.' }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.fechaPago)) {
    return { ok: false, mensaje: 'La fecha de pago no es válida.' }
  }

  const referencia = generarReferenciaPagoDesdePago(
    payload.alumnoRef,
    payload.conceptoNo,
    payload.cicloEscolar
  )

  const ahora = new Date().toISOString()
  const hora = new Date().toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  let pagoId = await obtenerSiguientePagoId()
  const fila = {
    pago_id: pagoId,
    alumno_id: payload.alumnoId,
    pago_nombre: payload.pagoNombre.trim().slice(0, 100) || null,
    pago_referencia: referencia,
    pago_importe: importe,
    pago_recargo: recargo,
    pago_forma: payload.formaPago.trim().slice(0, 30) || null,
    pago_folio: null,
    pago_fecha: payload.fechaPago,
    pago_hora: hora,
    pago_emisora: 'S/E',
    pago_cancelado: 3,
    pago_registro: ahora,
    pago_actualizacion: ahora,
    facturo: '',
    fact: '',
  }

  let { error } = await supabase.from('pago_detalle').insert(fila)

  if (error && esErrorClaveDuplicada(error)) {
    pagoId = await obtenerSiguientePagoId()
    const reintento = await supabase.from('pago_detalle').insert({ ...fila, pago_id: pagoId })
    error = reintento.error
  }

  if (error) {
    console.error('Error al crear pago manual:', error)
    return { ok: false, mensaje: error.message }
  }

  return { ok: true, pagoId, referencia }
}

/** Lista para selects de bauchers: sin tipo 3, deduplicada y ordenada 00→99. */
export function conceptosBoucherParaSelect(
  conceptos: ConceptoBoucher[]
): { no: string; clase: string }[] {
  const mapa = mapaConceptosPorNo(conceptos.filter((c) => c.concepto_tipo !== 3))
  return [...mapa.entries()].map(([no, clase]) => ({ no, clase }))
}
