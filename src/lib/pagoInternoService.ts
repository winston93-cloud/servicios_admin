import { supabase } from './supabase'
import type { AppDatabaseClient } from './dbTypes'
import { parseGradoEscolar } from './gradoEscolar'
import { parseNivelEscolar } from './nivelEscolar'
import { TUTOR_ID_MADRE, TUTOR_ID_PADRE } from './alumnoFamiliarTutor'
import {
  folioInicialPlantel,
  folioTechoPlantel,
  plantelPagoDesdeNivel,
  plantelSerieDesdeFolio,
  pagoPerteneceAPlantelSerie,
  type PlantelPagosInternos,
  type TipoSerieFolioPagoInterno,
  PAGO_INTERNO_FOLIO_EDUCATIVO_INICIAL,
  PAGO_INTERNO_FOLIO_EDUCATIVO_TECHO,
  PAGO_INTERNO_FOLIO_WINSTON_INICIAL,
  PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN,
  PAGO_INTERNO_FOLIO_WINSTON_TALON_ANTERIOR,
  PAGO_INTERNO_FOLIO_WINSTON_ZONA_TALON,
  PAGO_INTERNO_WINSTON_TALON_ACTUAL_DESDE,
} from './pagoInternoPlantel'
import { esAlumnoRefExterno } from './alumnoBusquedaServicios'
import { esConceptoTramiteControlEscolar } from './controlEscolarTramitesTipos'

async function avisarTramiteControlEscolar(payload: {
  pagoId: number
  alumnoId: number
  conceptoId: number
  pagoFolio: number
  pagoCiclo: number
}): Promise<void> {
  if (!esConceptoTramiteControlEscolar(payload.conceptoId)) return
  try {
    const res = await fetch('/api/control-escolar/tramites/desde-pago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error('aviso trámite CE HTTP', res.status, await res.text())
    }
  } catch (e) {
    console.error('aviso trámite CE:', e)
  }
}

async function cancelarTramitesControlEscolar(pagoIds: number[]): Promise<void> {
  const ids = pagoIds.filter((id) => Number.isFinite(id) && id > 0)
  if (!ids.length) return
  try {
    await fetch('/api/control-escolar/tramites/cancelar-pagos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagoIds: ids }),
    })
  } catch (e) {
    console.error('cancelar trámite CE:', e)
  }
}

export {
  accesoPagosInternosUsuario,
  ETIQUETA_PLANTEL_PAGOS_INTERNOS,
  folioInicialPlantel,
  folioTechoPlantel,
  plantelPagoDesdeNivel,
  plantelSerieDesdeFolio,
  pagoPerteneceAPlantelSerie,
  resolverPlantelFolioPagoInterno,
  PAGO_INTERNO_FOLIO_CUOTA_EDUCATIVO_INICIAL,
  PAGO_INTERNO_FOLIO_CUOTA_EDUCATIVO_TECHO,
  PAGO_INTERNO_FOLIO_CUOTA_WINSTON_INICIAL,
  PAGO_INTERNO_FOLIO_CUOTA_WINSTON_TECHO,
  PAGO_INTERNO_FOLIO_EDUCATIVO_INICIAL,
  PAGO_INTERNO_FOLIO_EDUCATIVO_TECHO,
  PAGO_INTERNO_FOLIO_INICIAL,
  PAGO_INTERNO_FOLIO_WINSTON_INICIAL,
  PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN,
  PAGO_INTERNO_FOLIO_WINSTON_TALON_ANTERIOR,
  PAGO_INTERNO_FOLIO_WINSTON_ZONA_TALON,
  PAGO_INTERNO_WINSTON_TALON_ACTUAL_DESDE,
  type AccesoPagosInternosUsuario,
  type PlantelPagosInternos,
  type TipoSerieFolioPagoInterno,
} from './pagoInternoPlantel'

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

export type PagoInternoListadoFila = PagoInternoRegistro & {
  alumno_ref: string | null
  alumno_nombre: string | null
  alumno_app: string | null
  alumno_apm: string | null
  alumno_nivel: number | null
  concepto_clase: string | null
  plantel_serie: PlantelPagosInternos | null
}

async function enriquecerPagosListado(
  pagos: PagoInternoRegistro[]
): Promise<PagoInternoListadoFila[]> {
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
    {
      alumno_ref: string | null
      alumno_nombre: string | null
      alumno_app: string | null
      alumno_apm: string | null
      alumno_nivel: number | null
    }
  >()
  const conceptosMap = new Map<number, string | null>()

  if (alumnoIds.length > 0) {
    const { data: alumnos } = await supabase
      .from('alumno')
      .select('alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel')
      .in('alumno_id', alumnoIds)
    for (const a of alumnos ?? []) {
      alumnosMap.set(Number(a.alumno_id), {
        alumno_ref: a.alumno_ref != null ? String(a.alumno_ref) : null,
        alumno_nombre: (a.alumno_nombre as string | null) ?? null,
        alumno_app: (a.alumno_app as string | null) ?? null,
        alumno_apm: (a.alumno_apm as string | null) ?? null,
        alumno_nivel:
          a.alumno_nivel != null && Number.isFinite(Number(a.alumno_nivel))
            ? Number(a.alumno_nivel)
            : null,
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
    const plantelPorNivel =
      alum?.alumno_nivel != null && Number.isFinite(alum.alumno_nivel)
        ? plantelPagoDesdeNivel(alum.alumno_nivel)
        : null
    return {
      ...p,
      alumno_ref: alum?.alumno_ref ?? null,
      alumno_nombre: alum?.alumno_nombre ?? null,
      alumno_app: alum?.alumno_app ?? null,
      alumno_apm: alum?.alumno_apm ?? null,
      alumno_nivel: alum?.alumno_nivel ?? null,
      concepto_clase: conceptosMap.get(p.concepto_id) ?? null,
      // Nivel del alumno gana sobre el folio cuando hay solape 2849–3479.
      plantel_serie: plantelPorNivel ?? plantelSerieDesdeFolio(p.pago_folio),
    }
  })
}

async function listarPagosRangoFolio(opts: {
  folioMin: number
  folioMaxExclusivo?: number
  folioExacto?: number | null
  limite: number
}): Promise<PagoInternoRegistro[]> {
  let q = supabase
    .from('pago_interno')
    .select(SELECT_PAGO)
    .eq('pago_cancelado', 0)
    .gte('pago_folio', opts.folioMin)
    .order('pago_folio', { ascending: false })
    .limit(opts.limite)

  if (opts.folioMaxExclusivo != null) {
    q = q.lt('pago_folio', opts.folioMaxExclusivo)
  }
  if (opts.folioExacto != null) {
    q = q.eq('pago_folio', opts.folioExacto)
  }

  const { data, error } = await q
  if (error) {
    console.error('Error al listar pagos internos por rango:', error)
    return []
  }
  return (data ?? []).map((r) => ({
    ...r,
    pago_importe: Number(r.pago_importe),
  })) as PagoInternoRegistro[]
}

/**
 * Orden del listado: talón Winston actual (4 dígitos, desde 2671) arriba,
 * talón anterior (26550+) abajo. Dentro de cada bloque: folio mayor → menor.
 */
function compararFoliosListadoPagosInternos(a: number, b: number): number {
  const bloque = (f: number) =>
    f >= PAGO_INTERNO_FOLIO_WINSTON_TALON_ANTERIOR ? 0 : 1
  const ba = bloque(a)
  const bb = bloque(b)
  if (bb !== ba) return bb - ba
  return b - a
}

/**
 * Rangos que el listado debe pedir por plantel.
 * Cuota Winston: solo 2140…2671. El talón general ya cubre 2671…4000; pedir
 * cuota hasta 2849 + LIMIT devolvería folios altos y ocultaría 2140–2669.
 */
function rangosFolioListadoPorPlantel(
  plantel: PlantelPagosInternos
): { folioMin: number; folioMaxExclusivo?: number }[] {
  if (plantel === 'winston') {
    return [
      {
        folioMin: PAGO_INTERNO_FOLIO_WINSTON_INICIAL,
        folioMaxExclusivo: PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN,
      },
      {
        folioMin: folioInicialPlantel('winston', 'cuota_padres'),
        folioMaxExclusivo: PAGO_INTERNO_FOLIO_WINSTON_INICIAL,
      },
      { folioMin: PAGO_INTERNO_FOLIO_WINSTON_TALON_ANTERIOR },
    ]
  }
  const techoCuotaEducativo = folioTechoPlantel('educativo', 'cuota_padres')
  return [
    {
      folioMin: PAGO_INTERNO_FOLIO_EDUCATIVO_INICIAL,
      folioMaxExclusivo: PAGO_INTERNO_FOLIO_EDUCATIVO_TECHO,
    },
    {
      folioMin: folioInicialPlantel('educativo', 'cuota_padres'),
      ...(techoCuotaEducativo != null ? { folioMaxExclusivo: techoCuotaEducativo } : {}),
    },
  ]
}

/** Lista series nuevas (Winston y/o Educativo), folio mayor → menor por bloque de talón. */
export async function listarPagosInternosPorPlanteles(
  planteles: PlantelPagosInternos[],
  opts?: { folioExacto?: number | null; limite?: number }
): Promise<PagoInternoListadoFila[]> {
  const limite = Math.min(Math.max(opts?.limite ?? 500, 1), 1000)
  const folioExacto =
    opts?.folioExacto != null && Number.isFinite(opts.folioExacto) && opts.folioExacto > 0
      ? Math.floor(opts.folioExacto)
      : null

  const unicos = [...new Set(planteles)]
  if (unicos.length === 0) return []

  const bloques: PagoInternoRegistro[] = []
  for (const plantel of unicos) {
    for (const rango of rangosFolioListadoPorPlantel(plantel)) {
      bloques.push(
        ...(await listarPagosRangoFolio({
          ...rango,
          folioExacto,
          limite,
        }))
      )
    }
  }

  const porId = new Map<number, PagoInternoRegistro>()
  for (const p of bloques) porId.set(p.pago_id, p)
  const pagos = [...porId.values()].sort((a, b) =>
    compararFoliosListadoPagosInternos(a.pago_folio, b.pago_folio)
  )
  const enriquecidos = await enriquecerPagosListado(pagos)
  // Filtrar por plantel real (nivel) para no mezclar Winston/Educativo en el solape 2849–3479.
  // Sin slice global: cada rango ya trae su propio LIMIT. Recortar al final
  // dejaba fuera cuota 1037–2139 / 2140–2669 si había 1000 folios más altos.
  return enriquecidos.filter((p) => {
    if (p.plantel_serie == null) return unicos.includes('winston')
    return unicos.includes(p.plantel_serie)
  })
}

/** @deprecated Usar listarPagosInternosPorPlanteles */
export async function listarPagosInternosSerieNueva(opts?: {
  folioExacto?: number | null
  limite?: number
}): Promise<PagoInternoListadoFila[]> {
  return listarPagosInternosPorPlanteles(['winston'], opts)
}

/** Conceptos que cuentan como cuota de padres pagada (legacy). */
export const CONCEPTOS_CUOTA_PADRES = [1, 2] as const

/** Concepto individual CUOTA DE PADRES. */
export const CONCEPTO_ID_CUOTA_PADRES = 2

/** Concepto MANUALES en catálogo legacy. */
export const CONCEPTO_ID_MANUALES = 5

/**
 * Combo legacy «* CUOTA DE PADRES + MANUALES» (concepto_id 1):
 * se cobra junto pero se registran e imprimen dos recibos (cuota + manuales).
 */
export const CONCEPTO_ID_CUOTA_PADRES_MAS_MANUALES = 1

/** True si el concepto usa la numeración propia de cuota de padres. */
export function esConceptoSerieCuotaPadres(conceptoId: number): boolean {
  return (CONCEPTOS_CUOTA_PADRES as readonly number[]).includes(conceptoId)
}

export function esConceptoCuotaPadresMasManuales(
  conceptoId: number,
  conceptoClase?: string | null
): boolean {
  if (conceptoId === CONCEPTO_ID_CUOTA_PADRES_MAS_MANUALES) return true
  const nombre = (conceptoClase ?? '').replace(/^\*\s*/, '').trim().toUpperCase()
  return (
    nombre.includes('CUOTA DE PADRES') &&
    nombre.includes('MANUALES') &&
    nombre.includes('+')
  )
}

export function esConceptoManuales(
  conceptoId: number,
  conceptoClase?: string | null
): boolean {
  if (esConceptoCuotaPadresMasManuales(conceptoId, conceptoClase)) return false
  if (conceptoId === CONCEPTO_ID_MANUALES) return true
  const nombre = (conceptoClase ?? '').replace(/^\*\s*/, '').trim().toUpperCase()
  return nombre === 'MANUALES'
}

/**
 * Siguiente folio de una de las 4 series independientes:
 * Winston|Educativo × cuota_padres|general.
 *
 * - Cuota: solo conceptos 1/2, rango propio por plantel.
 * - General: excluye cuota; Winston ignora legacy y sigue el consecutivo del talón
 *   (no el máximo absoluto: hay basura 2915+/39xx/7xxx que no cuenta).
 * - Incluye cancelados: el folio queda «quemado» (talón físico) y no se reutiliza
 *   al recapturar (p. ej. Emma 2957 cancelado → redo en 2958, no otra vez 2957).
 * - Filtra por plantel: nivel del alumno, y Externo (11404) cuenta en Winston
 *   (Juanita/Laura) para no duplicar folio.
 */
export async function obtenerSiguienteFolioPago(
  plantel: PlantelPagosInternos = 'winston',
  tipoSerie: TipoSerieFolioPagoInterno = 'general',
  db: AppDatabaseClient = supabase
): Promise<number> {
  const inicial = folioInicialPlantel(plantel, tipoSerie)
  let techo = folioTechoPlantel(plantel, tipoSerie)

  // Winston general: acotar búsqueda (legacy 4xxx+ y densos 39xx fuera).
  if (plantel === 'winston' && tipoSerie === 'general') {
    const zona = PAGO_INTERNO_FOLIO_WINSTON_ZONA_TALON
    techo = techo == null ? zona : Math.min(techo, zona)
  }

  const pageSize = 200
  let from = 0
  const foliosSerie = new Set<number>()

  for (let pass = 0; pass < 20; pass++) {
    let q = db
      .from('pago_interno')
      .select('pago_folio, alumno_id, concepto_id, pago_fecha')
      .gte('pago_folio', inicial)
      .order('pago_folio', { ascending: false })
      .range(from, from + pageSize - 1)

    if (techo != null) q = q.lt('pago_folio', techo)

    if (tipoSerie === 'cuota_padres') {
      q = q.in('concepto_id', [...CONCEPTOS_CUOTA_PADRES])
    } else {
      q = q.not('concepto_id', 'in', `(${CONCEPTOS_CUOTA_PADRES.join(',')})`)
    }

    // Winston general: ignorar histórico pre-talonario (36xx–39xx de 2024, etc.).
    if (plantel === 'winston' && tipoSerie === 'general') {
      q = q.gte('pago_fecha', PAGO_INTERNO_WINSTON_TALON_ACTUAL_DESDE)
    }

    const { data, error } = await q
    if (error) {
      // Nunca caer a `inicial` (p. ej. 2671): eso reinicia el talón y duplica.
      console.error('Error al obtener siguiente folio de pago interno:', error)
      throw new Error(
        `No se pudo calcular el siguiente folio (${tipoSerie}/${plantel}): ${error.message}`
      )
    }
    const batch = data ?? []
    if (batch.length === 0) break

    const alumnoIds = [
      ...new Set(
        batch
          .map((r) => Number(r.alumno_id))
          .filter((id) => Number.isFinite(id) && id > 0)
      ),
    ]
    const metaPorAlumno = new Map<number, { nivel: number; ref: string }>()
    if (alumnoIds.length > 0) {
      const { data: alumnos } = await db
        .from('alumno')
        .select('alumno_id, alumno_nivel, alumno_ref')
        .in('alumno_id', alumnoIds)
      for (const a of alumnos ?? []) {
        metaPorAlumno.set(Number(a.alumno_id), {
          nivel: Number(a.alumno_nivel) || 0,
          ref: String(a.alumno_ref ?? '').trim(),
        })
      }
    }

    for (const r of batch) {
      const folio = Number(r.pago_folio)
      if (!Number.isFinite(folio) || folio < inicial) continue
      const meta = metaPorAlumno.get(Number(r.alumno_id))
      if (!meta) continue
      if (
        !pagoPerteneceAPlantelSerie({
          plantel,
          alumnoNivel: meta.nivel,
          alumnoRef: meta.ref,
        })
      ) {
        continue
      }
      foliosSerie.add(folio)
    }

    if (batch.length < pageSize) break
    from += pageSize
  }

  if (foliosSerie.size === 0) return inicial

  const foliosAsc = [...foliosSerie].sort((a, b) => a - b)
  const maxEnSerie =
    plantel === 'winston' && tipoSerie === 'general'
      ? maxConsecutivoTalonWinston(foliosAsc, inicial)
      : foliosAsc[foliosAsc.length - 1]

  if (maxEnSerie == null || maxEnSerie < inicial) return inicial
  const siguiente = maxEnSerie + 1
  const techoSerie = folioTechoPlantel(plantel, tipoSerie)
  if (techoSerie != null && siguiente >= techoSerie) {
    const mensaje = `Serie de folio ${tipoSerie}/${plantel} agotada (siguiente ${siguiente} ≥ techo ${techoSerie})`
    console.error(mensaje)
    throw new Error(mensaje)
  }
  return siguiente
}

/**
 * Tip del talón Winston general (zona ya filtrada hasta legacy &lt; 4000).
 *
 * Usa el máximo de la serie filtrada (plantel + conceptos + fecha del talón
 * actual). No sembrar desde 2671: un hueco histórico reiniciaba el consecutivo.
 * Legacy ≥4000 queda fuera por techo; 36xx–39xx viejos por fecha ≥ 2026-01-01.
 */
export function maxConsecutivoTalonWinston(
  foliosAsc: number[],
  inicial: number
): number | null {
  const enZona = foliosAsc.filter((f) => f >= inicial)
  if (enZona.length === 0) return null
  return enZona[enZona.length - 1]!
}

export interface CrearPagoInternoPayload {
  alumno_id: number
  concepto_id: number
  concepto_otro?: string
  pago_folio?: number
  pago_importe: number
  pago_fecha: string
  pago_ciclo_escolar: number
  /** Serie de folio (Winston / Educativo). */
  plantel_serie: PlantelPagosInternos
  /**
   * Numeración: general (manuales y demás) o cuota de padres.
   * Si se omite, cuota (ids 1 y 2) usa `cuota_padres`.
   */
  tipo_serie_folio?: TipoSerieFolioPagoInterno
  /**
   * Si true, no replica la cuota a hermanos del mismo nivel.
   * Usar en el registro espejo para evitar recursión.
   */
  omitir_espejo_hermanos?: boolean
}

export type HermanoMismoNivelCuota = {
  alumno_id: number
  alumno_ref: string
  alumno_nivel: number
}

/**
 * Hermanos del mismo nivel (misma familia por cel/CURP de mamá/papá),
 * activos en el ciclo, excluyendo al alumno dado.
 * Regla de negocio: una sola cuota de padres cubre a todos los del mismo nivel.
 */
export async function listarHermanosMismoNivelParaCuota(
  alumnoId: number,
  cicloEscolar: number
): Promise<HermanoMismoNivelCuota[]> {
  const { data: alumno, error: alumnoErr } = await supabase
    .from('alumno')
    .select('alumno_id, alumno_nivel, alumno_ciclo_escolar')
    .eq('alumno_id', alumnoId)
    .maybeSingle()

  if (alumnoErr || !alumno) return []
  const nivel = Number(alumno.alumno_nivel) || 0
  if (!nivel) return []

  const { data: familiars } = await supabase
    .from('alumno_familiar')
    .select('familiar_cel, familiar_curp')
    .eq('alumno_id', alumnoId)
    .in('tutor_id', [TUTOR_ID_MADRE, TUTOR_ID_PADRE])

  const cels = new Set<string>()
  const curps = new Set<string>()
  for (const f of familiars ?? []) {
    const cel = String(f.familiar_cel ?? '').trim()
    const curp = String(f.familiar_curp ?? '').trim().toUpperCase()
    if (cel) cels.add(cel)
    if (curp) curps.add(curp)
  }
  if (cels.size === 0 && curps.size === 0) return []

  const ids = new Set<number>()
  for (const cel of cels) {
    const { data } = await supabase
      .from('alumno_familiar')
      .select('alumno_id')
      .eq('familiar_cel', cel)
      .in('tutor_id', [TUTOR_ID_MADRE, TUTOR_ID_PADRE])
    for (const r of data ?? []) ids.add(Number(r.alumno_id))
  }
  for (const curp of curps) {
    const { data } = await supabase
      .from('alumno_familiar')
      .select('alumno_id')
      .eq('familiar_curp', curp)
      .in('tutor_id', [TUTOR_ID_MADRE, TUTOR_ID_PADRE])
    for (const r of data ?? []) ids.add(Number(r.alumno_id))
  }
  ids.delete(alumnoId)
  if (ids.size === 0) return []

  const { data: hermanos, error } = await supabase
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_nivel, alumno_status, alumno_ciclo_escolar')
    .in('alumno_id', [...ids])
    .eq('alumno_ciclo_escolar', cicloEscolar)
    .eq('alumno_nivel', nivel)
    .not('alumno_status', 'in', '(0,2)')

  if (error || !hermanos?.length) return []
  return hermanos.map((h) => ({
    alumno_id: Number(h.alumno_id),
    alumno_ref: String(h.alumno_ref ?? '').trim(),
    alumno_nivel: Number(h.alumno_nivel) || 0,
  }))
}

export async function crearPagoInterno(
  payload: CrearPagoInternoPayload
): Promise<
  | { ok: true; pago_id: number; pago_folio: number; hermanos_cuota?: number }
  | { ok: false; mensaje: string }
> {
  const tipoSerie: TipoSerieFolioPagoInterno =
    payload.tipo_serie_folio ??
    (esConceptoSerieCuotaPadres(payload.concepto_id) ? 'cuota_padres' : 'general')

  // Folio del formulario: informativo. La asignación real siempre la decide
  // obtenerSiguienteFolioPago (salvo espejo de hermanos cuota = mismo folio).
  // Forzar desde UI reabriría duplicados / reinicios del talón.
  const folioForzado =
    payload.omitir_espejo_hermanos &&
    payload.pago_folio != null &&
    Number.isFinite(Number(payload.pago_folio))
      ? Number(payload.pago_folio)
      : null
  let folio: number
  try {
    folio =
      folioForzado ?? (await obtenerSiguienteFolioPago(payload.plantel_serie, tipoSerie))
  } catch (e) {
    return {
      ok: false,
      mensaje: e instanceof Error ? e.message : 'No se pudo asignar el siguiente folio',
    }
  }

  // Defensa: no insertar un folio ya usado en la misma serie (carrera o espejo).
  if (folioForzado == null) {
    let dupQ = supabase
      .from('pago_interno')
      .select('pago_id')
      .eq('pago_folio', folio)
      .limit(1)
    if (tipoSerie === 'cuota_padres') {
      dupQ = dupQ.in('concepto_id', [...CONCEPTOS_CUOTA_PADRES])
    } else {
      dupQ = dupQ.not('concepto_id', 'in', `(${CONCEPTOS_CUOTA_PADRES.join(',')})`)
    }
    const { data: dup } = await dupQ
    if (dup?.length) {
      try {
        folio = await obtenerSiguienteFolioPago(payload.plantel_serie, tipoSerie)
      } catch (e) {
        return {
          ok: false,
          mensaje: e instanceof Error ? e.message : 'Folio en uso; no se pudo recalcular',
        }
      }
    }
  }

  // Segunda lectura justo antes de insertar: dos clics a la vez tomaban el mismo folio.
  if (folioForzado == null) {
    for (let i = 0; i < 6; i += 1) {
      let liveQ = supabase
        .from('pago_interno')
        .select('pago_id')
        .eq('pago_folio', folio)
        .limit(1)
      if (tipoSerie === 'cuota_padres') {
        liveQ = liveQ.in('concepto_id', [...CONCEPTOS_CUOTA_PADRES])
      } else {
        liveQ = liveQ.not('concepto_id', 'in', `(${CONCEPTOS_CUOTA_PADRES.join(',')})`)
      }
      const { data: live } = await liveQ
      if (!live?.length) break
      folio = await obtenerSiguienteFolioPago(payload.plantel_serie, tipoSerie)
    }
  }

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

  let hermanosCuota = 0
  const debeEspejarCuota =
    !payload.omitir_espejo_hermanos && esConceptoSerieCuotaPadres(payload.concepto_id)

  if (debeEspejarCuota) {
    const { data: pagador } = await supabase
      .from('alumno')
      .select('alumno_ref')
      .eq('alumno_id', payload.alumno_id)
      .maybeSingle()
    const refPagador = String(pagador?.alumno_ref ?? '').trim() || String(payload.alumno_id)

    const hermanos = await listarHermanosMismoNivelParaCuota(
      payload.alumno_id,
      payload.pago_ciclo_escolar
    )
    for (const h of hermanos) {
      const yaTiene = await alumnoTieneCuotaPadresPagada(h.alumno_id, payload.pago_ciclo_escolar)
      if (yaTiene) continue
      const espejo = await crearPagoInterno({
        alumno_id: h.alumno_id,
        concepto_id: CONCEPTO_ID_CUOTA_PADRES,
        concepto_otro: `Cuota compartida c/ hermano ${refPagador}`,
        pago_folio: folio,
        pago_importe: 0,
        pago_fecha: payload.pago_fecha,
        pago_ciclo_escolar: payload.pago_ciclo_escolar,
        plantel_serie: payload.plantel_serie,
        tipo_serie_folio: 'cuota_padres',
        omitir_espejo_hermanos: true,
      })
      if (espejo.ok) hermanosCuota += 1
    }
  }

  await avisarTramiteControlEscolar({
    pagoId: nuevoId,
    alumnoId: payload.alumno_id,
    conceptoId: payload.concepto_id,
    pagoFolio: folio,
    pagoCiclo: payload.pago_ciclo_escolar,
  })

  return { ok: true, pago_id: nuevoId, pago_folio: folio, hermanos_cuota: hermanosCuota }
}

export function mensajeManualesRequiereCuotaPadres(): string {
  return 'Registra primero la cuota de padres en este ciclo escolar antes de pagar manuales.'
}

/** Precios separados del combo (nivel/grado). Null si falta alguno. */
export async function resolverPreciosCuotaYManuales(
  cicloEscolar: number,
  nivel: number | null,
  grado: number | null,
  opts?: { cualquierNivel?: boolean }
): Promise<{ cuota: number; manuales: number; total: number } | null> {
  const [cuota, manuales] = await Promise.all([
    resolverPrecioInterno(CONCEPTO_ID_CUOTA_PADRES, cicloEscolar, nivel, grado, opts),
    resolverPrecioInterno(CONCEPTO_ID_MANUALES, cicloEscolar, nivel, grado, opts),
  ])
  if (cuota == null || manuales == null) return null
  return {
    cuota,
    manuales,
    total: Math.round((cuota + manuales) * 100) / 100,
  }
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

export type ModoCancelacionPagoInterno = 'solo' | 'recorrer'

export type ResultadoCancelacionPagoInterno =
  | {
      ok: true
      modo: ModoCancelacionPagoInterno
      folioCancelado: number
      folioNuevo?: number
      filasAfectadas: number
      mensaje: string
    }
  | { ok: false; mensaje: string }

function resolverSerieDePago(
  pago: PagoInternoRegistro & {
    alumno_nivel?: number | null
    alumno_ref?: string | number | null
  }
): {
  plantel: PlantelPagosInternos
  tipoSerie: TipoSerieFolioPagoInterno
  folioMin: number
  folioMaxExclusivo: number | null
} | null {
  const folio = Number(pago.pago_folio)
  const tipoSerie: TipoSerieFolioPagoInterno = esConceptoSerieCuotaPadres(
    pago.concepto_id
  )
    ? 'cuota_padres'
    : 'general'

  // Externo (11404 / kinder cobrado en Winston): no usar solo nivel, o
  // cancelar+recorrer movería la serie Educativo por error.
  const esExterno = esAlumnoRefExterno(pago.alumno_ref)

  let plantel: PlantelPagosInternos | null = null
  if (esExterno) {
    // Siempre Winston: no usar zona 2849–3479 (Educativo) ni el nivel kinder.
    plantel = 'winston'
  } else {
    // En el solape 2849–3479 el folio solo no basta: usar nivel del alumno.
    const plantelPorNivel =
      pago.alumno_nivel != null && Number.isFinite(Number(pago.alumno_nivel))
        ? plantelPagoDesdeNivel(Number(pago.alumno_nivel))
        : null
    plantel = plantelPorNivel ?? plantelSerieDesdeFolio(folio)
  }
  if (!plantel) return null

  // Talón anterior Winston general: rango propio para cancelar/recorrer.
  if (
    plantel === 'winston' &&
    tipoSerie === 'general' &&
    folio >= PAGO_INTERNO_FOLIO_WINSTON_TALON_ANTERIOR
  ) {
    return {
      plantel,
      tipoSerie,
      folioMin: PAGO_INTERNO_FOLIO_WINSTON_TALON_ANTERIOR,
      folioMaxExclusivo: null,
    }
  }

  return {
    plantel,
    tipoSerie,
    folioMin: folioInicialPlantel(plantel, tipoSerie),
    folioMaxExclusivo: folioTechoPlantel(plantel, tipoSerie),
  }
}

async function siguientePagoId(): Promise<number> {
  const { data } = await supabase
    .from('pago_interno')
    .select('pago_id')
    .order('pago_id', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.pago_id ?? 0) + 1
}

export type ActualizarPagoInternoPayload = {
  pagoId: number
  concepto_id: number
  concepto_otro?: string
  pago_importe: number
  pago_fecha: string
  pago_ciclo_escolar: number
}

/**
 * Actualiza campos de un pago vigente. No cambia folio ni alumno
 * (protege la numeración del talón en producción).
 */
export async function actualizarPagoInterno(
  payload: ActualizarPagoInternoPayload
): Promise<{ ok: true; pago: PagoInternoRegistro } | { ok: false; mensaje: string }> {
  const pagoId = Number(payload.pagoId)
  if (!Number.isFinite(pagoId) || pagoId < 1) {
    return { ok: false, mensaje: 'pago_id inválido' }
  }
  const conceptoId = Number(payload.concepto_id)
  if (!Number.isFinite(conceptoId) || conceptoId < 1) {
    return { ok: false, mensaje: 'Concepto inválido' }
  }
  const importe = Math.round(Number(payload.pago_importe) * 100) / 100
  if (!Number.isFinite(importe) || importe < 0) {
    return { ok: false, mensaje: 'Monto inválido' }
  }
  const fecha = String(payload.pago_fecha ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { ok: false, mensaje: 'Fecha inválida' }
  }
  const ciclo = Number(payload.pago_ciclo_escolar)
  if (!Number.isFinite(ciclo) || ciclo < 1) {
    return { ok: false, mensaje: 'Ciclo escolar inválido' }
  }

  const { data: actual, error: fetchErr } = await supabase
    .from('pago_interno')
    .select(SELECT_PAGO)
    .eq('pago_id', pagoId)
    .maybeSingle()

  if (fetchErr || !actual) {
    return { ok: false, mensaje: fetchErr?.message ?? 'Pago no encontrado' }
  }
  const reg = actual as PagoInternoRegistro
  if (Number(reg.pago_cancelado) === 1) {
    return { ok: false, mensaje: 'No se puede modificar un pago cancelado' }
  }

  const ahora = new Date().toISOString()
  const { data: updated, error: upErr } = await supabase
    .from('pago_interno')
    .update({
      concepto_id: conceptoId,
      concepto_otro: (payload.concepto_otro ?? '').trim() || null,
      pago_importe: importe,
      pago_fecha: fecha,
      pago_ciclo_escolar: ciclo,
      pago_actualizacion: ahora,
    })
    .eq('pago_id', pagoId)
    .eq('pago_cancelado', 0)
    .select(SELECT_PAGO)
    .maybeSingle()

  if (upErr || !updated) {
    return { ok: false, mensaje: upErr?.message ?? 'No se pudo actualizar el pago' }
  }

  try {
    const eraTramite = esConceptoTramiteControlEscolar(reg.concepto_id)
    const esTramite = esConceptoTramiteControlEscolar(conceptoId)
    if (eraTramite && !esTramite) {
      await cancelarTramitesControlEscolar([pagoId])
    } else if (esTramite) {
      await avisarTramiteControlEscolar({
        pagoId,
        alumnoId: Number(reg.alumno_id),
        conceptoId,
        pagoFolio: Number(reg.pago_folio),
        pagoCiclo: ciclo,
      })
    }
  } catch (e) {
    console.error('Trámite CE al actualizar pago interno:', e)
  }

  return {
    ok: true,
    pago: {
      ...(updated as PagoInternoRegistro),
      pago_importe: Number((updated as PagoInternoRegistro).pago_importe),
    },
  }
}

/**
 * Cancela el pago (pago_cancelado = 1). El número queda quemado en el talón:
 * no se reutiliza; el siguiente folio es max(vigentes∪cancelados)+1.
 * No pide ni escribe nota en concepto_otro: el estado vive en pago_cancelado.
 * En cuota de padres también cancela espejos de hermanos con el mismo folio.
 */
export async function cancelarPagoInternoSolo(opts: {
  pagoId: number
  motivo?: string
}): Promise<ResultadoCancelacionPagoInterno> {
  const { data: pago, error } = await supabase
    .from('pago_interno')
    .select(SELECT_PAGO)
    .eq('pago_id', opts.pagoId)
    .maybeSingle()

  if (error || !pago) {
    return { ok: false, mensaje: error?.message ?? 'Pago no encontrado' }
  }

  const reg = pago as PagoInternoRegistro
  if (Number(reg.pago_cancelado) === 1) {
    return { ok: false, mensaje: 'Este pago ya está cancelado' }
  }

  const folio = Number(reg.pago_folio)
  const ahora = new Date().toISOString()

  let q = supabase
    .from('pago_interno')
    .update({
      pago_cancelado: 1,
      pago_actualizacion: ahora,
    })
    .eq('pago_folio', folio)
    .eq('pago_cancelado', 0)

  if (esConceptoSerieCuotaPadres(reg.concepto_id)) {
    q = q.in('concepto_id', [...CONCEPTOS_CUOTA_PADRES])
  } else {
    q = q.eq('pago_id', reg.pago_id)
  }

  const { data: updated, error: upErr } = await q.select('pago_id')
  if (upErr) {
    return { ok: false, mensaje: upErr.message }
  }

  const n = updated?.length ?? 0
  await cancelarTramitesControlEscolar((updated ?? []).map((r) => Number(r.pago_id)))
  return {
    ok: true,
    modo: 'solo',
    folioCancelado: folio,
    filasAfectadas: n,
    mensaje: `Folio ${folio} cancelado. Ese número queda fuera de uso.`,
  }
}

/**
 * Cancela el folio actual (queda stub cancelado) y recorre +1 todos los vigentes
 * de la misma serie desde ese folio (contenido → folio siguiente).
 */
export async function cancelarPagoInternoYRecorrer(opts: {
  pagoId: number
  motivo?: string
}): Promise<ResultadoCancelacionPagoInterno> {
  const { data: pago, error } = await supabase
    .from('pago_interno')
    .select(SELECT_PAGO)
    .eq('pago_id', opts.pagoId)
    .maybeSingle()

  if (error || !pago) {
    return { ok: false, mensaje: error?.message ?? 'Pago no encontrado' }
  }

  const reg = pago as PagoInternoRegistro
  if (Number(reg.pago_cancelado) === 1) {
    return { ok: false, mensaje: 'Este pago ya está cancelado' }
  }

  let alumnoNivel: number | null = null
  let alumnoRef: string | null = null
  if (reg.alumno_id != null) {
    const { data: alum } = await supabase
      .from('alumno')
      .select('alumno_nivel, alumno_ref')
      .eq('alumno_id', reg.alumno_id)
      .maybeSingle()
    if (alum?.alumno_nivel != null && Number.isFinite(Number(alum.alumno_nivel))) {
      alumnoNivel = Number(alum.alumno_nivel)
    }
    if (alum?.alumno_ref != null) {
      alumnoRef = String(alum.alumno_ref).trim()
    }
  }

  const serie = resolverSerieDePago({
    ...reg,
    alumno_nivel: alumnoNivel,
    alumno_ref: alumnoRef,
  })
  if (!serie) {
    return {
      ok: false,
      mensaje: `No se pudo determinar la serie del folio ${reg.pago_folio}`,
    }
  }

  const folioOrig = Number(reg.pago_folio)
  const ahora = new Date().toISOString()

  let listQ = supabase
    .from('pago_interno')
    .select(SELECT_PAGO)
    .gte('pago_folio', folioOrig)
    .eq('pago_cancelado', 0)
    .order('pago_folio', { ascending: false })

  if (serie.folioMaxExclusivo != null) {
    listQ = listQ.lt('pago_folio', serie.folioMaxExclusivo)
  }
  if (serie.tipoSerie === 'cuota_padres') {
    listQ = listQ.in('concepto_id', [...CONCEPTOS_CUOTA_PADRES])
  }
  // No desplazar histórico 36xx–39xx al recorrer el talón actual.
  if (serie.plantel === 'winston' && serie.tipoSerie === 'general') {
    listQ = listQ.gte('pago_fecha', PAGO_INTERNO_WINSTON_TALON_ACTUAL_DESDE)
  }

  const { data: filasRaw, error: listErr } = await listQ
  if (listErr) return { ok: false, mensaje: listErr.message }

  const filas = ((filasRaw ?? []) as PagoInternoRegistro[]).filter((f) => {
    if (serie.tipoSerie === 'cuota_padres') return true
    return !esConceptoSerieCuotaPadres(f.concepto_id)
  })
  if (!filas.length) {
    return { ok: false, mensaje: 'No hay pagos vigentes para recorrer' }
  }
  // Recorrer de mayor a menor para evitar choques mentales (no hay unique en folio).
  let desplazados = 0
  for (const fila of filas) {
    const { error: shiftErr } = await supabase
      .from('pago_interno')
      .update({
        pago_folio: Number(fila.pago_folio) + 1,
        pago_actualizacion: ahora,
      })
      .eq('pago_id', fila.pago_id)
      .eq('pago_cancelado', 0)

    if (shiftErr) {
      return {
        ok: false,
        mensaje: `Error al recorrer folio ${fila.pago_folio}: ${shiftErr.message}`,
      }
    }
    desplazados += 1
  }

  const stubId = await siguientePagoId()
  const { error: insErr } = await supabase.from('pago_interno').insert({
    pago_id: stubId,
    alumno_id: reg.alumno_id,
    concepto_id: reg.concepto_id,
    concepto_otro: reg.concepto_otro,
    pago_folio: folioOrig,
    pago_importe: reg.pago_importe,
    pago_fecha: reg.pago_fecha,
    pago_cancelado: 1,
    pago_ciclo_escolar: reg.pago_ciclo_escolar,
    pago_registro: ahora,
    pago_actualizacion: ahora,
  })

  if (insErr) {
    return {
      ok: false,
      mensaje: `Recorrido hecho, pero falló el stub cancelado del ${folioOrig}: ${insErr.message}`,
    }
  }

  return {
    ok: true,
    modo: 'recorrer',
    folioCancelado: folioOrig,
    folioNuevo: folioOrig + 1,
    filasAfectadas: desplazados,
    mensaje: `Folio ${folioOrig} cancelado. El contenido pasó al ${folioOrig + 1} y se recorrieron ${desplazados} pago(s) de la serie.`,
  }
}

/** Folio de continuación tras BARREIRO 2836 (12-ago en orden de captura). */
export const FOLIO_REPARACION_WINSTON_INICIO = 2837
/** Último folio Winston general correcto antes del salto erróneo 2837–2847 (BARREIRO 11-ago). */
export const FOLIO_REPARACION_WINSTON_ULTIMO_OK = 2836
/** Desde esta fecha se renumeró mal al forzar ARVIZU en 2848. */
export const FECHA_REPARACION_WINSTON_DESDE = '2026-08-12'

export type ResultadoReparacionFoliosWinston =
  | {
      ok: true
      aplicada: boolean
      cambios: number
      siguienteFolio: number
      detalle?: string[]
      mensaje: string
    }
  | { ok: false; mensaje: string }

/**
 * Fallback cliente (misma lógica que POST /api/servicios/reparar-folios-winston).
 * Import dinámico evita ciclo con repararFoliosWinstonInsforge.ts.
 */
export async function repararFoliosWinstonTrasReinicio2671(): Promise<ResultadoReparacionFoliosWinston> {
  try {
    const { repararFoliosWinstonGeneralInsforge } = await import(
      '@/lib/repararFoliosWinstonInsforge'
    )
    const res = await repararFoliosWinstonGeneralInsforge(supabase, {
      cancelarDuplicados: true,
    })
    return {
      ok: true,
      aplicada: res.aplicada,
      cambios: res.cambios,
      siguienteFolio: res.siguienteFolio,
      detalle: res.detalle,
      mensaje: res.mensaje,
    }
  } catch (e) {
    return {
      ok: false,
      mensaje: e instanceof Error ? e.message : 'Error al reparar folios Winston',
    }
  }
}
