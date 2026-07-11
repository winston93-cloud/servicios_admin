import type { AppDatabaseClient } from '@/lib/dbTypes'
import { normalizarConceptoNo } from './pagoReferenciaColegiatura'

export interface ConceptoBoucherRegistro {
  concepto_id: number
  concepto_no: string
  concepto_clase: string
  alumno_nivel: number
  concepto_tipo: number
  concepto_descuento: number
}

export type ConceptoBoucherInput = {
  concepto_no: string
  concepto_clase: string
  alumno_nivel: number
  concepto_tipo: number
  concepto_descuento: number
}

export const CONCEPTO_TIPOS = [
  { valor: 0, etiqueta: 'Sin clasificar' },
  { valor: 1, etiqueta: 'Inscripción' },
  { valor: 2, etiqueta: 'Colegiatura / cuota' },
  { valor: 3, etiqueta: 'Otro' },
] as const

const SELECT =
  'concepto_id, concepto_no, concepto_clase, alumno_nivel, concepto_tipo, concepto_descuento'

function mapRow(r: Record<string, unknown>): ConceptoBoucherRegistro {
  return {
    concepto_id: Number(r.concepto_id),
    concepto_no: normalizarConceptoNo(String(r.concepto_no ?? '')),
    concepto_clase: String(r.concepto_clase ?? '').trim(),
    alumno_nivel: Number(r.alumno_nivel ?? 0),
    concepto_tipo: Number(r.concepto_tipo ?? 0),
    concepto_descuento: Number(r.concepto_descuento ?? 0) ? 1 : 0,
  }
}

function validarInput(input: ConceptoBoucherInput): ConceptoBoucherInput {
  const concepto_no = normalizarConceptoNo(input.concepto_no)
  if (!/^\d{2}$/.test(concepto_no)) {
    throw new Error('concepto_no debe ser 2 dígitos (ej. 00, 13)')
  }
  const concepto_clase = String(input.concepto_clase ?? '').trim()
  if (!concepto_clase || concepto_clase.length > 100) {
    throw new Error('concepto_clase requerido (máx. 100)')
  }
  const alumno_nivel = Number(input.alumno_nivel)
  if (!Number.isFinite(alumno_nivel) || alumno_nivel < 0 || alumno_nivel > 4) {
    throw new Error('alumno_nivel debe ser 0 (todos) o 1–4')
  }
  const concepto_tipo = Number(input.concepto_tipo)
  if (![0, 1, 2, 3].includes(concepto_tipo)) {
    throw new Error('concepto_tipo inválido (0–3)')
  }
  const concepto_descuento = Number(input.concepto_descuento) ? 1 : 0
  return {
    concepto_no,
    concepto_clase,
    alumno_nivel,
    concepto_tipo,
    concepto_descuento,
  }
}

export async function listarConceptosBoucherCatalogo(
  db: AppDatabaseClient
): Promise<ConceptoBoucherRegistro[]> {
  const { data, error } = await db
    .from('concepto_boucher')
    .select(SELECT)
    .order('concepto_no', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
}

async function siguienteConceptoId(db: AppDatabaseClient): Promise<number> {
  const { data, error } = await db
    .from('concepto_boucher')
    .select('concepto_id')
    .order('concepto_id', { ascending: false })
    .limit(1)

  if (error) throw new Error(error.message)
  const max = data?.[0]?.concepto_id != null ? Number(data[0].concepto_id) : 0
  return max + 1
}

export async function crearConceptoBoucher(
  db: AppDatabaseClient,
  input: ConceptoBoucherInput
): Promise<ConceptoBoucherRegistro> {
  const payload = validarInput(input)
  const concepto_id = await siguienteConceptoId(db)

  const { data, error } = await db
    .from('concepto_boucher')
    .insert({ concepto_id, ...payload })
    .select(SELECT)
    .single()

  if (error || !data) {
    if (/unique|duplicate/i.test(error?.message ?? '')) {
      throw new Error(`Ya existe el concepto_no ${payload.concepto_no}`)
    }
    throw new Error(error?.message ?? 'No se pudo crear el concepto')
  }
  return mapRow(data as Record<string, unknown>)
}

export async function actualizarConceptoBoucher(
  db: AppDatabaseClient,
  conceptoId: number,
  input: ConceptoBoucherInput
): Promise<ConceptoBoucherRegistro> {
  if (!conceptoId) throw new Error('concepto_id requerido')
  const payload = validarInput(input)

  const { data, error } = await db
    .from('concepto_boucher')
    .update(payload)
    .eq('concepto_id', conceptoId)
    .select(SELECT)
    .single()

  if (error || !data) {
    if (/unique|duplicate/i.test(error?.message ?? '')) {
      throw new Error(`Ya existe el concepto_no ${payload.concepto_no}`)
    }
    throw new Error(error?.message ?? 'No se pudo actualizar el concepto')
  }
  return mapRow(data as Record<string, unknown>)
}

export async function eliminarConceptoBoucher(
  db: AppDatabaseClient,
  conceptoId: number
): Promise<void> {
  if (!conceptoId) throw new Error('concepto_id requerido')
  const { error } = await db.from('concepto_boucher').delete().eq('concepto_id', conceptoId)
  if (error) throw new Error(error.message)
}

export function etiquetaConceptoTipo(tipo: number): string {
  return CONCEPTO_TIPOS.find((t) => t.valor === tipo)?.etiqueta ?? `Tipo ${tipo}`
}
