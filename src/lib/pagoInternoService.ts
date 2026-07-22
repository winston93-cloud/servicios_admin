import { supabase } from './supabase'
import { parseGradoEscolar } from './gradoEscolar'
import { parseNivelEscolar } from './nivelEscolar'

// --- Conceptos ---

export interface ConceptoInterno {
  concepto_id: number
  concepto_clase: string | null
  visible: number
  orden_visible: number
}

export function compararTextoAz(a: string | null | undefined, b: string | null | undefined): number {
  return String(a ?? '').localeCompare(String(b ?? ''), 'es', { sensitivity: 'base' })
}

export function ordenarConceptosAz(lista: ConceptoInterno[]): ConceptoInterno[] {
  return [...lista].sort((a, b) => compararTextoAz(a.concepto_clase, b.concepto_clase))
}

export function nombreConceptoInterno(
  conceptoId: number,
  conceptos: ConceptoInterno[]
): string {
  return conceptos.find((c) => c.concepto_id === conceptoId)?.concepto_clase ?? String(conceptoId)
}

export interface ConceptoInternoInput {
  concepto_id: number
  concepto_clase: string
  visible: number
  orden_visible: number
}

export async function listarConceptosInternos(soloVisibles = false): Promise<ConceptoInterno[]> {
  let q = supabase
    .from('concepto_interno')
    .select('concepto_id, concepto_clase, visible, orden_visible')
    .order('orden_visible', { ascending: true })
    .order('concepto_id', { ascending: true })

  if (soloVisibles) {
    q = q.eq('visible', 1)
  }

  const { data, error } = await q
  if (error) {
    console.error('Error al listar concepto_interno:', error)
    return []
  }
  return (data ?? []) as ConceptoInterno[]
}

export async function guardarConceptoInterno(
  input: ConceptoInternoInput,
  esNuevo: boolean
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const fila = {
    concepto_id: input.concepto_id,
    concepto_clase: input.concepto_clase.trim(),
    visible: input.visible ? 1 : 0,
    orden_visible: input.orden_visible,
  }

  if (esNuevo) {
    const { error } = await supabase.from('concepto_interno').insert(fila)
    if (error) return { ok: false, mensaje: error.message }
    return { ok: true }
  }

  const { error } = await supabase
    .from('concepto_interno')
    .update({
      concepto_clase: fila.concepto_clase,
      visible: fila.visible,
      orden_visible: fila.orden_visible,
    })
    .eq('concepto_id', input.concepto_id)

  if (error) return { ok: false, mensaje: error.message }
  return { ok: true }
}

export async function eliminarConceptoInterno(
  conceptoId: number
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const { error } = await supabase.from('concepto_interno').delete().eq('concepto_id', conceptoId)
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true }
}

// --- Precios ---

export interface PagoInternoPrecio {
  precio_interno_id: number
  alumno_nivel: number
  alumno_grado: number
  concepto_id: number
  precio_interno: number
  precio_ciclo_escolar: number
}

export interface PagoInternoPrecioInput {
  precio_interno_id?: number
  alumno_nivel: number
  alumno_grado: number
  concepto_id: number
  precio_interno: number
  precio_ciclo_escolar: number
}

export function ordenarPreciosPorConceptoAz(
  precios: PagoInternoPrecio[],
  conceptos: ConceptoInterno[]
): PagoInternoPrecio[] {
  return [...precios].sort((a, b) => {
    const na = nombreConceptoInterno(a.concepto_id, conceptos)
    const nb = nombreConceptoInterno(b.concepto_id, conceptos)
    const porConcepto = compararTextoAz(na, nb)
    if (porConcepto !== 0) return porConcepto
    if (a.alumno_nivel !== b.alumno_nivel) return a.alumno_nivel - b.alumno_nivel
    return a.alumno_grado - b.alumno_grado
  })
}

export async function listarPreciosInternos(
  cicloEscolar?: number
): Promise<PagoInternoPrecio[]> {
  let q = supabase
    .from('pago_interno_precio')
    .select(
      'precio_interno_id, alumno_nivel, alumno_grado, concepto_id, precio_interno, precio_ciclo_escolar'
    )
    .order('precio_interno_id', { ascending: true })

  if (cicloEscolar != null) {
    q = q.eq('precio_ciclo_escolar', cicloEscolar)
  }

  const { data, error } = await q
  if (error) {
    console.error('Error al listar pago_interno_precio:', error)
    return []
  }
  return (data ?? []).map((r) => ({
    ...r,
    precio_interno: Number(r.precio_interno),
  })) as PagoInternoPrecio[]
}

export async function guardarPrecioInterno(
  input: PagoInternoPrecioInput
): Promise<{ ok: true; precio_interno_id: number } | { ok: false; mensaje: string }> {
  const fila = {
    alumno_nivel: input.alumno_nivel,
    alumno_grado: input.alumno_grado,
    concepto_id: input.concepto_id,
    precio_interno: Math.round(input.precio_interno * 100) / 100,
    precio_ciclo_escolar: input.precio_ciclo_escolar,
  }

  if (input.precio_interno_id != null) {
    const { error } = await supabase
      .from('pago_interno_precio')
      .update(fila)
      .eq('precio_interno_id', input.precio_interno_id)
    if (error) return { ok: false, mensaje: error.message }
    return { ok: true, precio_interno_id: input.precio_interno_id }
  }

  const { data: maxRow } = await supabase
    .from('pago_interno_precio')
    .select('precio_interno_id')
    .order('precio_interno_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nuevoId = (maxRow?.precio_interno_id ?? 0) + 1
  const { error } = await supabase.from('pago_interno_precio').insert({
    precio_interno_id: nuevoId,
    ...fila,
  })
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true, precio_interno_id: nuevoId }
}

export async function eliminarPrecioInterno(
  precioInternoId: number
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const { error } = await supabase
    .from('pago_interno_precio')
    .delete()
    .eq('precio_interno_id', precioInternoId)
  if (error) return { ok: false, mensaje: error.message }
  return { ok: true }
}

/** Busca precio: exacto nivel+grado → nivel+grado 0 → 0+0.
 *  Con `cualquierNivel` (p. ej. control Externo 11404): si no hay match,
 *  usa cualquier tarifa del concepto en el ciclo (prioriza grado 0).
 */
export async function resolverPrecioInterno(
  conceptoId: number,
  cicloEscolar: number,
  nivel: number | null,
  grado: number | null,
  opts?: { cualquierNivel?: boolean }
): Promise<number | null> {
  const n = nivel ?? 0
  const g = grado ?? 0

  const { data, error } = await supabase
    .from('pago_interno_precio')
    .select('precio_interno, alumno_nivel, alumno_grado')
    .eq('concepto_id', conceptoId)
    .eq('precio_ciclo_escolar', cicloEscolar)

  if (error || !data?.length) return null

  const filas = data as { precio_interno: number; alumno_nivel: number; alumno_grado: number }[]
  const orden = [
    (f: (typeof filas)[0]) => f.alumno_nivel === n && f.alumno_grado === g,
    (f: (typeof filas)[0]) => f.alumno_nivel === n && f.alumno_grado === 0,
    (f: (typeof filas)[0]) => f.alumno_nivel === 0 && f.alumno_grado === 0,
  ]
  for (const match of orden) {
    const hit = filas.find(match)
    if (hit) return Number(hit.precio_interno)
  }

  if (opts?.cualquierNivel) {
    const porGradoCero = filas.find((f) => Number(f.alumno_grado) === 0)
    return Number((porGradoCero ?? filas[0]).precio_interno)
  }

  return null
}

// --- Pagos ---

export interface PagoInternoRegistro {
  pago_id: number
  alumno_id: number | null
  concepto_id: number
  concepto_otro: string | null
  pago_folio: number
  pago_importe: number
  pago_fecha: string | null
  pago_cancelado: number
  pago_ciclo_escolar: number | null
  pago_registro: string | null
}

const SELECT_PAGO =
  'pago_id, alumno_id, concepto_id, concepto_otro, pago_folio, pago_importe, pago_fecha, pago_cancelado, pago_ciclo_escolar, pago_registro'

export async function listarPagosPorAlumno(
  alumnoId: number,
  cicloEscolar?: number
): Promise<PagoInternoRegistro[]> {
  let q = supabase
    .from('pago_interno')
    .select(SELECT_PAGO)
    .eq('alumno_id', alumnoId)
    .eq('pago_cancelado', 0)
    .order('pago_fecha', { ascending: false })
    .order('pago_id', { ascending: false })

  if (cicloEscolar != null) {
    q = q.eq('pago_ciclo_escolar', cicloEscolar)
  }

  const { data, error } = await q
  if (error) {
    console.error('Error al listar pagos internos:', error)
    return []
  }
  return (data ?? []).map((r) => ({
    ...r,
    pago_importe: Number(r.pago_importe),
  })) as PagoInternoRegistro[]
}

/** Primer folio de recibos de pagos internos en el sistema nuevo. */
export const PAGO_INTERNO_FOLIO_INICIAL = 26550

export type PagoInternoListadoFila = PagoInternoRegistro & {
  alumno_ref: string | null
  alumno_nombre: string | null
  alumno_app: string | null
  alumno_apm: string | null
  concepto_clase: string | null
}

export async function listarPagosInternosSerieNueva(opts?: {
  folioExacto?: number | null
  limite?: number
}): Promise<PagoInternoListadoFila[]> {
  const limite = Math.min(Math.max(opts?.limite ?? 500, 1), 1000)
  const folioExacto =
    opts?.folioExacto != null && Number.isFinite(opts.folioExacto) && opts.folioExacto > 0
      ? Math.floor(opts.folioExacto)
      : null

  let q = supabase
    .from('pago_interno')
    .select(SELECT_PAGO)
    .eq('pago_cancelado', 0)
    .gte('pago_folio', PAGO_INTERNO_FOLIO_INICIAL)
    .order('pago_folio', { ascending: true })
    .limit(limite)

  if (folioExacto != null) {
    q = q.eq('pago_folio', folioExacto)
  }

  const { data, error } = await q
  if (error) {
    console.error('Error al listar pagos internos (serie nueva):', error)
    return []
  }

  const pagos = (data ?? []).map((r) => ({
    ...r,
    pago_importe: Number(r.pago_importe),
  })) as PagoInternoRegistro[]

  if (pagos.length === 0) return []

  const alumnoIds = [
    ...new Set(
      pagos
        .map((p) => p.alumno_id)
        .filter((id): id is number => id != null && Number.isFinite(id))
    ),
  ]
  const conceptoIds = [...new Set(pagos.map((p) => p.concepto_id))]

  const alumnosMap = new Map<
    number,
    { alumno_ref: string | null; alumno_nombre: string | null; alumno_app: string | null; alumno_apm: string | null }
  >()
  const conceptosMap = new Map<number, string | null>()

  if (alumnoIds.length > 0) {
    const { data: alumnos } = await supabase
      .from('alumno')
      .select('alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm')
      .in('alumno_id', alumnoIds)
    for (const a of alumnos ?? []) {
      alumnosMap.set(Number(a.alumno_id), {
        alumno_ref: a.alumno_ref != null ? String(a.alumno_ref) : null,
        alumno_nombre: (a.alumno_nombre as string | null) ?? null,
        alumno_app: (a.alumno_app as string | null) ?? null,
        alumno_apm: (a.alumno_apm as string | null) ?? null,
      })
    }
  }

  if (conceptoIds.length > 0) {
    const { data: conceptos } = await supabase
      .from('concepto_interno')
      .select('concepto_id, concepto_clase')
      .in('concepto_id', conceptoIds)
    for (const c of conceptos ?? []) {
      conceptosMap.set(Number(c.concepto_id), (c.concepto_clase as string | null) ?? null)
    }
  }

  return pagos.map((p) => {
    const alum = p.alumno_id != null ? alumnosMap.get(p.alumno_id) : undefined
    return {
      ...p,
      alumno_ref: alum?.alumno_ref ?? null,
      alumno_nombre: alum?.alumno_nombre ?? null,
      alumno_app: alum?.alumno_app ?? null,
      alumno_apm: alum?.alumno_apm ?? null,
      concepto_clase: conceptosMap.get(p.concepto_id) ?? null,
    }
  })
}

export async function obtenerSiguienteFolioPago(): Promise<number> {
  const { data, error } = await supabase
    .from('pago_interno')
    .select('pago_folio')
    .gte('pago_folio', PAGO_INTERNO_FOLIO_INICIAL)
    .order('pago_folio', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.pago_folio) return PAGO_INTERNO_FOLIO_INICIAL
  const max = Number(data.pago_folio)
  if (!Number.isFinite(max) || max < PAGO_INTERNO_FOLIO_INICIAL) {
    return PAGO_INTERNO_FOLIO_INICIAL
  }
  return max + 1
}

export interface CrearPagoInternoPayload {
  alumno_id: number
  concepto_id: number
  concepto_otro?: string
  pago_folio?: number
  pago_importe: number
  pago_fecha: string
  pago_ciclo_escolar: number
}

export async function crearPagoInterno(
  payload: CrearPagoInternoPayload
): Promise<{ ok: true; pago_id: number; pago_folio: number } | { ok: false; mensaje: string }> {
  // Folio autoincremental desde 26550 (no depende del valor del formulario).
  const folio = await obtenerSiguienteFolioPago()

  const { data: maxRow } = await supabase
    .from('pago_interno')
    .select('pago_id')
    .order('pago_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nuevoId = (maxRow?.pago_id ?? 0) + 1
  const ahora = new Date().toISOString()

  const { error } = await supabase.from('pago_interno').insert({
    pago_id: nuevoId,
    alumno_id: payload.alumno_id,
    concepto_id: payload.concepto_id,
    concepto_otro: (payload.concepto_otro ?? '').trim() || null,
    pago_folio: folio,
    pago_importe: Math.round(payload.pago_importe * 100) / 100,
    pago_fecha: payload.pago_fecha,
    pago_cancelado: 0,
    pago_ciclo_escolar: payload.pago_ciclo_escolar,
    pago_registro: ahora,
    pago_actualizacion: ahora,
  })

  if (error) {
    console.error('Error al crear pago interno:', error)
    return { ok: false, mensaje: error.message }
  }

  return { ok: true, pago_id: nuevoId, pago_folio: folio }
}

/** Conceptos que cuentan como cuota de padres pagada (legacy). */
export const CONCEPTOS_CUOTA_PADRES = [1, 2] as const

/** Concepto MANUALES en catálogo legacy. */
export const CONCEPTO_ID_MANUALES = 5

export function esConceptoManuales(
  conceptoId: number,
  conceptoClase?: string | null
): boolean {
  if (conceptoId === CONCEPTO_ID_MANUALES) return true
  const nombre = (conceptoClase ?? '').replace(/^\*\s*/, '').trim().toUpperCase()
  return nombre === 'MANUALES'
}

export function mensajeManualesRequiereCuotaPadres(): string {
  return 'Registra primero la cuota de padres en este ciclo escolar antes de pagar manuales.'
}

export async function alumnoTieneCuotaPadresPagada(
  alumnoId: number,
  cicloEscolar: number
): Promise<boolean> {
  const { data, error } = await supabase
    .from('pago_interno')
    .select('pago_id')
    .eq('alumno_id', alumnoId)
    .eq('pago_ciclo_escolar', cicloEscolar)
    .eq('pago_cancelado', 0)
    .in('concepto_id', [...CONCEPTOS_CUOTA_PADRES])
    .limit(1)

  if (error) return false
  return (data?.length ?? 0) > 0
}

export function nivelGradoDesdeAlumno(
  alumnoNivel: string | number | null | undefined,
  alumnoGrado: string | number | null | undefined
): { nivel: number; grado: number } {
  return {
    nivel: parseNivelEscolar(alumnoNivel) ?? 0,
    grado: parseGradoEscolar(alumnoGrado) ?? 0,
  }
}
