/**
 * Reparación idempotente del consecutivo Winston general (no cuota de padres).
 * Continúa el talón tras BARREIRO 2836 → siguiente 2837 (12-ago en orden de captura).
 * Incluye cancelados que ocupan talón (redo Emma / stub recorrer).
 * Duplicados cancelados del mismo alumno (mismo folio) salen a 9xxxxx.
 */
import type { AppDatabaseClient } from '@/lib/dbTypes'
import {
  CONCEPTOS_CUOTA_PADRES,
  CONCEPTO_ID_MANUALES,
  FECHA_REPARACION_WINSTON_DESDE,
  FOLIO_REPARACION_WINSTON_INICIO,
  FOLIO_REPARACION_WINSTON_ULTIMO_OK,
  obtenerSiguienteFolioPago,
} from '@/lib/pagoInternoService'
import {
  PAGO_INTERNO_FOLIO_WINSTON_INICIAL,
  PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN,
  pagoPerteneceAPlantelSerie,
} from '@/lib/pagoInternoPlantel'
import { ALUMNO_REF_EXTERNO } from '@/lib/alumnoBusquedaServicios'

const SELECT_PAGO =
  'pago_id, alumno_id, concepto_id, concepto_otro, pago_folio, pago_importe, pago_fecha, pago_cancelado, pago_ciclo_escolar, pago_registro'

const FOLIO_TEMP_BASE = 900_000

export type PagoInternoRow = {
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

function esCuota(conceptoId: number): boolean {
  return (CONCEPTOS_CUOTA_PADRES as readonly number[]).includes(conceptoId)
}

function nombreEsEduardoArvizu(
  nombre: string | null | undefined,
  app: string | null | undefined,
  apm: string | null | undefined
): boolean {
  const nom = `${nombre ?? ''} ${app ?? ''} ${apm ?? ''}`
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  return nom.includes('ARVIZU') && nom.includes('EDUARDO')
}

function nombreCompletoUpper(
  nombre: string | null | undefined,
  app: string | null | undefined,
  apm: string | null | undefined
): string {
  return `${app ?? ''} ${apm ?? ''} ${nombre ?? ''}`
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function coincideNombre(nombreObjetivo: string, app?: string | null, apm?: string | null, nombre?: string | null): boolean {
  const n = nombreCompletoUpper(nombre, app, apm)
  const tokens = nombreObjetivo
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/\s+/)
    .filter(Boolean)
  return tokens.every((t) => n.includes(t))
}

async function buscarAlumnoIdsPorNombre(
  db: AppDatabaseClient,
  nombreObjetivo: string
): Promise<number[]> {
  const { data, error } = await db
    .from('alumno')
    .select('alumno_id, alumno_nombre, alumno_app, alumno_apm')
    .limit(8000)
  if (error) throw new Error(error.message)
  return (data ?? [])
    .filter((a) => coincideNombre(nombreObjetivo, a.alumno_app, a.alumno_apm, a.alumno_nombre))
    .map((a) => Number(a.alumno_id))
}

async function fetchPagosDesdeFecha(
  db: AppDatabaseClient,
  fechaMin: string
): Promise<PagoInternoRow[]> {
  const pageSize = 1000
  const out: PagoInternoRow[] = []
  let from = 0
  for (;;) {
    const { data, error } = await db
      .from('pago_interno')
      .select(SELECT_PAGO)
      .gte('pago_fecha', fechaMin)
      .order('pago_fecha', { ascending: true })
      .order('pago_id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as PagoInternoRow[]
    out.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return out
}

/**
 * Dos modos de cancelación en pagos internos vs talón físico:
 *
 * 1) Mismo folio / duplicado: capturas de más del mismo alumno+concepto+fecha
 *    canceladas después del vigente → no ocupan número (Alonso 2961/2962).
 *    También dedupe (RAHI) que quedó en el mismo folio que el vigente.
 *
 * 2) Cancelar y siguiente del mismo alumno:
 *    - Solo cancelar + recaptura: cancelado (pago_id menor) quema N; redo = N+1 (Emma).
 *    - Cancelar y recorrer: stub cancelado en N y contenido vigente en N+1.
 */
export function separarCanceladosFueraDeTalon(rows: PagoInternoRow[]): {
  enTalon: PagoInternoRow[]
  sombras: PagoInternoRow[]
} {
  const porGrupo = new Map<string, PagoInternoRow[]>()
  for (const p of rows) {
    const key = `${Number(p.alumno_id)}|${Number(p.concepto_id)}|${String(p.pago_fecha ?? '').slice(0, 10)}`
    if (!porGrupo.has(key)) porGrupo.set(key, [])
    porGrupo.get(key)!.push(p)
  }

  const enTalon: PagoInternoRow[] = []
  const sombras: PagoInternoRow[] = []

  for (const list of porGrupo.values()) {
    const vigentes = list.filter((p) => Number(p.pago_cancelado) === 0)
    const cancelados = list.filter((p) => Number(p.pago_cancelado) === 1)

    if (vigentes.length === 0) {
      enTalon.push(...list)
      continue
    }

    enTalon.push(...vigentes)
    const maxVigenteId = Math.max(...vigentes.map((p) => Number(p.pago_id)))

    for (const c of cancelados) {
      const cid = Number(c.pago_id)
      const cFolio = Number(c.pago_folio)

      // Emma: canceló y luego recapturó (vigente con pago_id mayor).
      if (cid < maxVigenteId) {
        enTalon.push(c)
        continue
      }

      // Recorrer: stub cancelado en N y contenido del mismo alumno en N+1.
      const esStubRecorrer = vigentes.some((v) => Number(v.pago_folio) === cFolio + 1)
      if (esStubRecorrer) {
        enTalon.push(c)
        continue
      }

      // Duplicado / mismo folio: no ocupa talón (Alonso, RAHI dedupe).
      sombras.push(c)
    }
  }

  return { enTalon, sombras }
}

/** @deprecated alias — usar separarCanceladosFueraDeTalon */
export function separarSombrasDuplicadoMismoFolio(rows: PagoInternoRow[]) {
  return separarCanceladosFueraDeTalon(rows)
}

async function fetchStuck2671(db: AppDatabaseClient): Promise<PagoInternoRow[]> {
  const { data, error } = await db
    .from('pago_interno')
    .select(SELECT_PAGO)
    .eq('pago_folio', PAGO_INTERNO_FOLIO_WINSTON_INICIAL)
    .eq('pago_cancelado', 0)
    .limit(500)
  if (error) throw new Error(error.message)
  return (data ?? []) as PagoInternoRow[]
}

async function metaAlumnos(
  db: AppDatabaseClient,
  alumnoIds: number[]
): Promise<Map<number, { nivel: number; ref: string }>> {
  const map = new Map<number, { nivel: number; ref: string }>()
  for (let i = 0; i < alumnoIds.length; i += 200) {
    const slice = alumnoIds.slice(i, i + 200)
    const { data, error } = await db
      .from('alumno')
      .select('alumno_id, alumno_nivel, alumno_ref')
      .in('alumno_id', slice)
    if (error) throw new Error(error.message)
    for (const a of data ?? []) {
      map.set(Number(a.alumno_id), {
        nivel: Number(a.alumno_nivel) || 0,
        ref: String(a.alumno_ref ?? '').trim(),
      })
    }
  }
  return map
}

async function enriquecerAlumnos(
  db: AppDatabaseClient,
  alumnoIds: number[]
): Promise<Map<number, { nombre: string; ref: string | null }>> {
  const map = new Map<number, { nombre: string; ref: string | null }>()
  for (let i = 0; i < alumnoIds.length; i += 200) {
    const slice = alumnoIds.slice(i, i + 200)
    const { data, error } = await db
      .from('alumno')
      .select('alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm')
      .in('alumno_id', slice)
    if (error) throw new Error(error.message)
    for (const a of data ?? []) {
      const ref = a.alumno_ref != null ? String(a.alumno_ref).trim() : null
      const esExterno = ref === ALUMNO_REF_EXTERNO || (ref ?? '').toLowerCase() === 'externo'
      map.set(Number(a.alumno_id), {
        ref,
        nombre: esExterno
          ? 'EXTERNO'
          : nombreCompletoUpper(a.alumno_nombre, a.alumno_app, a.alumno_apm) ||
            `#${a.alumno_id}`,
      })
    }
  }
  return map
}

export type AuditFolioWinston = {
  duplicadosFolio: {
    folio: number
    count: number
    pagos: { pago_id: number; alumno: string; concepto_id: number; fecha: string | null }[]
  }[]
  folioConsulta: Record<
    string,
    { pago_id: number; folio: number; alumno: string; concepto_id: number; fecha: string | null }[]
  >
}

/** Audita folios duplicados Winston general (≥2848) y casos puntuales. */
export async function auditarFoliosWinstonGeneral(
  db: AppDatabaseClient,
  foliosConsulta: number[] = [2880, 2919, 2920, 3120, 3121, 3128, 3129]
): Promise<AuditFolioWinston> {
  const { data, error } = await db
    .from('pago_interno')
    .select(SELECT_PAGO)
    .gte('pago_folio', FOLIO_REPARACION_WINSTON_INICIO)
    .lt('pago_folio', PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN)
    .eq('pago_cancelado', 0)
    .order('pago_folio', { ascending: true })
    .limit(5000)
  if (error) throw new Error(error.message)

  const rows = ((data ?? []) as PagoInternoRow[]).filter((p) => !esCuota(p.concepto_id))
  const alumnoIds = [...new Set(rows.map((p) => Number(p.alumno_id)).filter(Boolean))]
  const [metas, alumnos] = await Promise.all([
    metaAlumnos(db, alumnoIds),
    enriquecerAlumnos(db, alumnoIds),
  ])

  const winston = rows.filter((p) => {
    const meta = p.alumno_id != null ? metas.get(Number(p.alumno_id)) : null
    if (!meta) return false
    return pagoPerteneceAPlantelSerie({
      plantel: 'winston',
      alumnoNivel: meta.nivel,
      alumnoRef: meta.ref,
    })
  })

  const porFolio = new Map<number, PagoInternoRow[]>()
  for (const p of winston) {
    const f = Number(p.pago_folio)
    if (!porFolio.has(f)) porFolio.set(f, [])
    porFolio.get(f)!.push(p)
  }

  const duplicadosFolio = [...porFolio.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([folio, list]) => ({
      folio,
      count: list.length,
      pagos: list.map((p) => ({
        pago_id: Number(p.pago_id),
        alumno: alumnos.get(Number(p.alumno_id))?.nombre ?? `#${p.alumno_id}`,
        concepto_id: Number(p.concepto_id),
        fecha: p.pago_fecha,
      })),
    }))
    .sort((a, b) => a.folio - b.folio)

  const folioConsulta: AuditFolioWinston['folioConsulta'] = {}
  for (const f of foliosConsulta) {
    const list = porFolio.get(f) ?? []
    folioConsulta[String(f)] = list.map((p) => ({
      pago_id: Number(p.pago_id),
      folio: Number(p.pago_folio),
      alumno: alumnos.get(Number(p.alumno_id))?.nombre ?? `#${p.alumno_id}`,
      concepto_id: Number(p.concepto_id),
      fecha: p.pago_fecha,
    }))
  }

  return { duplicadosFolio, folioConsulta }
}

export type ResultadoReparacionWinstonInsforge = {
  ok: true
  aplicada: boolean
  cambios: number
  canceladosDuplicados: number
  siguienteFolio: number
  revisados: number
  ancla: { pago_id: number; folio: number; fecha: string }
  detalle: string[]
  audit: AuditFolioWinston
  series: {
    winston_general: number
    winston_cuota: number
    educativo_general: number
    educativo_cuota: number
  }
  mensaje: string
}

/**
 * Cancela capturas duplicadas del mismo concepto/alumno/fecha (p. ej. CONSTANCIA
 * de RAHI con folios 2919 y 2920). Conserva el pago_id menor.
 */
export async function cancelarCapturasDuplicadasWinston(
  db: AppDatabaseClient,
  opts?: { dryRun?: boolean; alumnoNombre?: string; fechaMin?: string }
): Promise<{ cancelados: number; detalle: string[] }> {
  const dryRun = opts?.dryRun ?? false
  let alumnoIds: number[] | null = null
  if (opts?.alumnoNombre) {
    alumnoIds = await buscarAlumnoIdsPorNombre(db, opts.alumnoNombre)
    if (alumnoIds.length === 0) return { cancelados: 0, detalle: [] }
  }

  const fechaMin = opts?.fechaMin ?? '2026-08-12'
  const { data, error } = await db
    .from('pago_interno')
    .select(SELECT_PAGO)
    .gte('pago_folio', FOLIO_REPARACION_WINSTON_INICIO)
    .lt('pago_folio', PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN)
    .gte('pago_fecha', fechaMin)
    .eq('pago_cancelado', 0)
    .order('pago_id', { ascending: true })
    .limit(5000)
  if (error) throw new Error(error.message)

  let rows = ((data ?? []) as PagoInternoRow[]).filter((p) => !esCuota(p.concepto_id))
  const alumnoIdsAll = [...new Set(rows.map((p) => Number(p.alumno_id)).filter(Boolean))]
  const metas = await metaAlumnos(db, alumnoIdsAll)
  rows = rows.filter((p) => {
    const meta = p.alumno_id != null ? metas.get(Number(p.alumno_id)) : null
    if (!meta) return false
    return pagoPerteneceAPlantelSerie({
      plantel: 'winston',
      alumnoNivel: meta.nivel,
      alumnoRef: meta.ref,
    })
  })
  if (alumnoIds) {
    rows = rows.filter((p) => alumnoIds!.includes(Number(p.alumno_id)))
  }

  const grupos = new Map<string, PagoInternoRow[]>()
  for (const p of rows) {
    const key = `${p.alumno_id}|${p.concepto_id}|${String(p.pago_fecha ?? '').slice(0, 10)}`
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(p)
  }

  const detalle: string[] = []
  let cancelados = 0
  const ahora = new Date().toISOString()

  for (const [, list] of grupos) {
    if (list.length < 2) continue
    const ordenados = [...list].sort((a, b) => Number(a.pago_id) - Number(b.pago_id))
    const conservar = ordenados[0]
    for (const dup of ordenados.slice(1)) {
      detalle.push(
        `cancelar pago_id=${dup.pago_id} folio=${dup.pago_folio} (conservar ${conservar.pago_id} folio=${conservar.pago_folio})`
      )
      if (!dryRun) {
        const { error: upErr } = await db
          .from('pago_interno')
          .update({ pago_cancelado: 1, pago_actualizacion: ahora })
          .eq('pago_id', dup.pago_id)
        if (upErr) throw new Error(upErr.message)
      }
      cancelados += 1
    }
  }

  return { cancelados, detalle }
}

export type PlanReparacionWinston = {
  anclaRow: PagoInternoRow
  anclaId: number
  anclaFecha: string
  aReparar: PagoInternoRow[]
  sombrasFueraDeTalon: PagoInternoRow[]
  asignaciones: { pago_id: number; de: number; a: number; fecha: string | null }[]
  siguienteEsperado: number
}

/**
 * Plan: deja intacto ≤2836 (11-ago BARREIRO).
 * Renumerar Winston general (vigentes + cancelados que ocupan talón) con fecha
 * ≥12-ago desde 2837, orden: pago_fecha → pago_registro → pago_id.
 * Cancelados duplicados del mismo alumno (no redo / no stub recorrer) salen del consecutivo.
 */
export async function construirPlanReparacionWinston(
  db: AppDatabaseClient,
  opts?: { excluirPagoIds?: number[] }
): Promise<PlanReparacionWinston> {
  const fechaDesde = FECHA_REPARACION_WINSTON_DESDE
  const folioInicio = FOLIO_REPARACION_WINSTON_INICIO
  const excluir = new Set(opts?.excluirPagoIds ?? [])

  const { data: ultimoOkRows, error: errUltimo } = await db
    .from('pago_interno')
    .select(SELECT_PAGO)
    .eq('pago_folio', FOLIO_REPARACION_WINSTON_ULTIMO_OK)
    .eq('pago_cancelado', 0)
    .limit(5)
  if (errUltimo) throw new Error(errUltimo.message)

  const anclaRow = ((ultimoOkRows ?? [])[0] ?? {
    pago_id: 0,
    alumno_id: null,
    concepto_id: 0,
    concepto_otro: null,
    pago_folio: FOLIO_REPARACION_WINSTON_ULTIMO_OK,
    pago_importe: 0,
    pago_fecha: '2026-08-11',
    pago_cancelado: 0,
    pago_ciclo_escolar: null,
    pago_registro: null,
  }) as PagoInternoRow

  const porFecha = await fetchPagosDesdeFecha(db, fechaDesde)
  const stuck2671 = await fetchStuck2671(db)

  const porId = new Map<number, PagoInternoRow>()
  for (const p of [...porFecha, ...stuck2671]) {
    if (esCuota(Number(p.concepto_id))) continue
    const folio = Number(p.pago_folio)
    // Fuera del talón (p. ej. NOGUERA ya en 9xxxxx): no reentrar al consecutivo.
    if (folio >= FOLIO_TEMP_BASE) continue
    const enSerie =
      folio >= PAGO_INTERNO_FOLIO_WINSTON_INICIAL &&
      folio < PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN
    if (!enSerie) continue
    const fecha = String(p.pago_fecha ?? '')
    if (fecha < fechaDesde) continue
    porId.set(Number(p.pago_id), p as PagoInternoRow)
  }

  const alumnoIds = [...new Set([...porId.values()].map((p) => Number(p.alumno_id)).filter(Boolean))]
  const metas = await metaAlumnos(db, alumnoIds)

  const candidatos = [...porId.values()].filter((p) => {
    if (excluir.has(Number(p.pago_id))) return false
    const meta = p.alumno_id != null ? metas.get(Number(p.alumno_id)) : null
    if (!meta) return false
    return pagoPerteneceAPlantelSerie({
      plantel: 'winston',
      alumnoNivel: meta.nivel,
      alumnoRef: meta.ref,
    })
  })

  const { enTalon, sombras } = separarCanceladosFueraDeTalon(candidatos)

  const aReparar = enTalon.sort((a, b) => {
    const fa = String(a.pago_fecha ?? '')
    const fb = String(b.pago_fecha ?? '')
    if (fa !== fb) return fa < fb ? -1 : 1
    const ra = String(a.pago_registro ?? '')
    const rb = String(b.pago_registro ?? '')
    if (ra !== rb) return ra < rb ? -1 : 1
    return Number(a.pago_id) - Number(b.pago_id)
  })

  const asignaciones: PlanReparacionWinston['asignaciones'] = []
  let folio = folioInicio
  for (const p of aReparar) {
    const actual = Number(p.pago_folio)
    const destino = folio
    if (actual !== destino) {
      asignaciones.push({
        pago_id: Number(p.pago_id),
        de: actual,
        a: destino,
        fecha: p.pago_fecha,
      })
    }
    folio += 1
  }

  return {
    anclaRow,
    anclaId: Number(anclaRow.pago_id),
    anclaFecha: String(anclaRow.pago_fecha ?? '2026-08-11'),
    aReparar,
    sombrasFueraDeTalon: sombras,
    asignaciones,
    siguienteEsperado: folio,
  }
}

export type DiagnosticoFoliosWinston = {
  ancla: { pago_id: number; folio: number; fecha: string }
  revisados: number
  desajustes: number
  siguienteEsperado: number
  siguienteSegunApi: number
  desde: string
  enPeriodo: number
  desajustesEnPeriodo: {
    pago_id: number
    alumno: string
    fecha: string | null
    registro: string | null
    folioActual: number
    folioEsperado: number
  }[]
  porFecha: Record<string, { capturas: number; folioMin: number; folioMax: number }>
  ultimosDiez: {
    pago_id: number
    alumno: string
    fecha: string | null
    folio: number
    folioEsperado: number
    concepto_id: number
  }[]
  canceladosEnRango: {
    pago_id: number
    folio: number
    fecha: string | null
    alumno_id: number | null
  }[]
  mensaje: string
}

export type FilaAuditoriaFolioWinston = {
  folio: number
  pago_id: number
  alumno: string
  alumno_ref: string | null
  concepto_id: number
  concepto: string
  concepto_otro: string | null
  importe: number
  fecha: string | null
  registro: string | null
  cancelado: boolean
}

/** Lista Winston general por rango de folio (para cruzar con talonario). */
export async function listarAuditoriaFoliosWinston(
  db: AppDatabaseClient,
  opts: { desdeFolio: number; limit?: number }
): Promise<{
  desdeFolio: number
  hastaFolio: number
  filas: FilaAuditoriaFolioWinston[]
  huecos: number[]
  mensaje: string
}> {
  const desdeFolio = Math.floor(opts.desdeFolio)
  const limit = Math.min(Math.max(Math.floor(opts.limit ?? 10), 1), 50)
  const hastaFolio = desdeFolio + limit - 1

  const { data, error } = await db
    .from('pago_interno')
    .select(SELECT_PAGO)
    .gte('pago_folio', desdeFolio)
    .lte('pago_folio', hastaFolio)
    .order('pago_folio', { ascending: true })
    .order('pago_id', { ascending: true })
    .limit(500)
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as PagoInternoRow[]
  const alumnoIds = [...new Set(rows.map((p) => Number(p.alumno_id)).filter(Boolean))]
  const [metas, alumnos, conceptos] = await Promise.all([
    metaAlumnos(db, alumnoIds),
    enriquecerAlumnos(db, alumnoIds),
    (async () => {
      const { data: c, error: e } = await db
        .from('concepto_interno')
        .select('concepto_id, concepto_clase')
        .limit(200)
      if (e) throw new Error(e.message)
      const m = new Map<number, string>()
      for (const row of c ?? []) {
        m.set(Number(row.concepto_id), String(row.concepto_clase ?? ''))
      }
      return m
    })(),
  ])

  const filas: FilaAuditoriaFolioWinston[] = []
  for (const p of rows) {
    if (esCuota(Number(p.concepto_id))) continue
    const metaNivel = p.alumno_id != null ? metas.get(Number(p.alumno_id)) : null
    if (
      !metaNivel ||
      !pagoPerteneceAPlantelSerie({
        plantel: 'winston',
        alumnoNivel: metaNivel.nivel,
        alumnoRef: metaNivel.ref,
      })
    ) {
      continue
    }
    const meta = alumnos.get(Number(p.alumno_id))
    filas.push({
      folio: Number(p.pago_folio),
      pago_id: Number(p.pago_id),
      alumno: meta?.nombre ?? `#${p.alumno_id}`,
      alumno_ref: meta?.ref ?? null,
      concepto_id: Number(p.concepto_id),
      concepto: conceptos.get(Number(p.concepto_id)) ?? `concepto ${p.concepto_id}`,
      concepto_otro: p.concepto_otro,
      importe: Number(p.pago_importe),
      fecha: p.pago_fecha,
      registro: p.pago_registro,
      cancelado: Number(p.pago_cancelado) === 1,
    })
  }

  const presentes = new Set(filas.filter((f) => !f.cancelado).map((f) => f.folio))
  const huecos: number[] = []
  for (let f = desdeFolio; f <= hastaFolio; f++) {
    if (!presentes.has(f)) huecos.push(f)
  }

  return {
    desdeFolio,
    hastaFolio,
    filas,
    huecos,
    mensaje: `Auditoría Winston general ${desdeFolio}–${hastaFolio}: ${filas.length} fila(s), ${huecos.length} hueco(s).`,
  }
}

/** Lista pagos internos por fecha de pago (todas las series; para auditar talón día a día). */
export async function listarPagosInternosPorFecha(
  db: AppDatabaseClient,
  opts: { fecha: string; limit?: number }
): Promise<{
  fecha: string
  filas: FilaAuditoriaFolioWinston[]
  mensaje: string
}> {
  const fecha = String(opts.fecha).slice(0, 10)
  const limit = Math.min(Math.max(Math.floor(opts.limit ?? 200), 1), 500)

  const { data, error } = await db
    .from('pago_interno')
    .select(SELECT_PAGO)
    .eq('pago_fecha', fecha)
    .order('pago_folio', { ascending: true })
    .order('pago_id', { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as PagoInternoRow[]
  const alumnoIds = [...new Set(rows.map((p) => Number(p.alumno_id)).filter(Boolean))]
  const [metas, alumnos, conceptos] = await Promise.all([
    metaAlumnos(db, alumnoIds),
    enriquecerAlumnos(db, alumnoIds),
    (async () => {
      const { data: c, error: e } = await db
        .from('concepto_interno')
        .select('concepto_id, concepto_clase')
        .limit(200)
      if (e) throw new Error(e.message)
      const m = new Map<number, string>()
      for (const row of c ?? []) {
        m.set(Number(row.concepto_id), String(row.concepto_clase ?? ''))
      }
      return m
    })(),
  ])

  const filas: FilaAuditoriaFolioWinston[] = rows.map((p) => {
    const meta = alumnos.get(Number(p.alumno_id))
    const metaNivel = p.alumno_id != null ? metas.get(Number(p.alumno_id)) : null
    const esWinston =
      metaNivel != null &&
      pagoPerteneceAPlantelSerie({
        plantel: 'winston',
        alumnoNivel: metaNivel.nivel,
        alumnoRef: metaNivel.ref,
      })
    const plantel = metaNivel == null ? '?' : esWinston ? 'W' : 'E'
    const cuota = esCuota(Number(p.concepto_id)) ? 'cuota' : 'general'
    return {
      folio: Number(p.pago_folio),
      pago_id: Number(p.pago_id),
      alumno: meta?.nombre ?? `#${p.alumno_id}`,
      alumno_ref: meta?.ref ?? null,
      concepto_id: Number(p.concepto_id),
      concepto: `${conceptos.get(Number(p.concepto_id)) ?? `concepto ${p.concepto_id}`} [${plantel}/${cuota}]`,
      concepto_otro: p.concepto_otro,
      importe: Number(p.pago_importe),
      fecha: p.pago_fecha,
      registro: p.pago_registro,
      cancelado: Number(p.pago_cancelado) === 1,
    }
  })

  return {
    fecha,
    filas,
    mensaje: `${filas.length} pago(s) con fecha ${fecha} (todas las series).`,
  }
}

/** Diagnóstico detallado desde 12-ago (salto 2837). */
export async function diagnosticarFoliosWinstonGeneralInsforge(
  db: AppDatabaseClient,
  opts?: { desde?: string }
): Promise<DiagnosticoFoliosWinston> {
  const desde = opts?.desde ?? FECHA_REPARACION_WINSTON_DESDE
  const plan = await construirPlanReparacionWinston(db)
  const alumnoIds = [...new Set(plan.aReparar.map((p) => Number(p.alumno_id)).filter(Boolean))]
  const alumnos = await enriquecerAlumnos(db, alumnoIds)

  const desajustesEnPeriodo: DiagnosticoFoliosWinston['desajustesEnPeriodo'] = []
  const porFecha: DiagnosticoFoliosWinston['porFecha'] = {}
  let enPeriodo = 0

  plan.aReparar.forEach((p, idx) => {
    const folioEsperado = FOLIO_REPARACION_WINSTON_INICIO + idx
    const folioActual = Number(p.pago_folio)
    const fecha = String(p.pago_fecha ?? '').slice(0, 10)
    const alumno = alumnos.get(Number(p.alumno_id))?.nombre ?? `#${p.alumno_id}`

    if (fecha >= desde) {
      enPeriodo += 1
      if (!porFecha[fecha]) {
        porFecha[fecha] = { capturas: 0, folioMin: folioActual, folioMax: folioActual }
      }
      const bucket = porFecha[fecha]
      bucket.capturas += 1
      bucket.folioMin = Math.min(bucket.folioMin, folioActual)
      bucket.folioMax = Math.max(bucket.folioMax, folioActual)

      if (folioActual !== folioEsperado) {
        desajustesEnPeriodo.push({
          pago_id: Number(p.pago_id),
          alumno,
          fecha: p.pago_fecha,
          registro: p.pago_registro,
          folioActual,
          folioEsperado,
        })
      }
    }
  })

  const ultimosDiez = plan.aReparar.slice(-10).map((p, _i, arr) => {
    const idx = plan.aReparar.length - arr.length + _i
    return {
      pago_id: Number(p.pago_id),
      alumno: alumnos.get(Number(p.alumno_id))?.nombre ?? `#${p.alumno_id}`,
      fecha: p.pago_fecha,
      folio: Number(p.pago_folio),
      folioEsperado: FOLIO_REPARACION_WINSTON_INICIO + idx,
      concepto_id: Number(p.concepto_id),
    }
  })

  const { data: cancelados, error: errCan } = await db
    .from('pago_interno')
    .select('pago_id, alumno_id, pago_folio, pago_fecha')
    .gte('pago_folio', FOLIO_REPARACION_WINSTON_INICIO)
    .lt('pago_folio', PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN)
    .gte('pago_fecha', desde)
    .eq('pago_cancelado', 1)
    .order('pago_folio', { ascending: true })
    .limit(200)
  if (errCan) throw new Error(errCan.message)

  const siguienteSegunApi = await obtenerSiguienteFolioPago('winston', 'general', db)

  const desajustes = plan.asignaciones.length
  const mensaje =
    desajustes === 0 && desajustesEnPeriodo.length === 0
      ? `Consecutivo interno OK (${plan.aReparar.length} pagos). Siguiente ${siguienteSegunApi}. Revisar con talonario físico del 13-ago.`
      : `${desajustes} desajuste(s) total; ${desajustesEnPeriodo.length} desde ${desde}. Siguiente API ${siguienteSegunApi}, esperado reparación ${plan.siguienteEsperado}.`

  return {
    ancla: {
      pago_id: plan.anclaId,
      folio: Number(plan.anclaRow.pago_folio),
      fecha: plan.anclaFecha,
    },
    revisados: plan.aReparar.length,
    desajustes,
    siguienteEsperado: plan.siguienteEsperado,
    siguienteSegunApi,
    desde,
    enPeriodo,
    desajustesEnPeriodo: desajustesEnPeriodo.slice(0, 100),
    porFecha,
    ultimosDiez,
    canceladosEnRango: (cancelados ?? []).map((p) => ({
      pago_id: Number(p.pago_id),
      folio: Number(p.pago_folio),
      fecha: p.pago_fecha,
      alumno_id: p.alumno_id != null ? Number(p.alumno_id) : null,
    })),
    mensaje,
  }
}

async function cancelarNogueraConstanciaFueraDeTalon12Ago(
  db: AppDatabaseClient,
  opts?: { dryRun?: boolean }
): Promise<{ cancelados: number; movidos: number; excluirPagoIds: number[]; detalle: string[] }> {
  const dryRun = opts?.dryRun ?? false
  const detalle: string[] = []
  const excluirPagoIds: number[] = []
  let cancelados = 0
  let movidos = 0

  const { data, error } = await db
    .from('pago_interno')
    .select(SELECT_PAGO)
    .eq('pago_fecha', FECHA_REPARACION_WINSTON_DESDE)
    .eq('concepto_id', 3) // CONSTANCIA
    .gte('pago_folio', FOLIO_REPARACION_WINSTON_INICIO)
    .lt('pago_folio', PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN)
    .limit(50)
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as PagoInternoRow[]
  if (rows.length === 0) return { cancelados, movidos, excluirPagoIds, detalle }

  const alumnoIds = [...new Set(rows.map((p) => Number(p.alumno_id)).filter(Boolean))]
  const alumnos = await enriquecerAlumnos(db, alumnoIds)
  const ahora = new Date().toISOString()

  for (const p of rows) {
    const nombre = alumnos.get(Number(p.alumno_id))?.nombre ?? ''
    if (!nombre.includes('NOGUERA')) continue
    excluirPagoIds.push(Number(p.pago_id))

    if (Number(p.pago_cancelado) === 0) {
      const temp = FOLIO_TEMP_BASE + Number(p.pago_id)
      detalle.push(
        `cancelar+mover NOGUERA CONSTANCIA pago_id=${p.pago_id} folio ${p.pago_folio}→${temp} (talón: 2848=ARVIZU)`
      )
      if (!dryRun) {
        const { error: upErr } = await db
          .from('pago_interno')
          .update({
            pago_cancelado: 1,
            pago_folio: temp,
            pago_actualizacion: ahora,
          })
          .eq('pago_id', p.pago_id)
        if (upErr) throw new Error(upErr.message)
      }
      cancelados += 1
    } else {
      const temp = FOLIO_TEMP_BASE + Number(p.pago_id)
      detalle.push(
        `mover cancelado NOGUERA pago_id=${p.pago_id} folio ${p.pago_folio}→${temp} (fuera del talón)`
      )
      if (!dryRun) {
        const { error: upErr } = await db
          .from('pago_interno')
          .update({ pago_folio: temp })
          .eq('pago_id', p.pago_id)
        if (upErr) throw new Error(upErr.message)
      }
      movidos += 1
    }
  }

  return { cancelados, movidos, excluirPagoIds, detalle }
}

/** Repara consecutivo Winston general desde 2837 (dos fases). */
export async function repararFoliosWinstonGeneralInsforge(
  db: AppDatabaseClient,
  opts?: { dryRun?: boolean; cancelarDuplicados?: boolean }
): Promise<ResultadoReparacionWinstonInsforge> {
  const dryRun = opts?.dryRun ?? false
  let canceladosDuplicados = 0
  const cancelDetalle: string[] = []

  const noguera = await cancelarNogueraConstanciaFueraDeTalon12Ago(db, { dryRun })
  canceladosDuplicados += noguera.cancelados
  cancelDetalle.push(...noguera.detalle)

  let plan: PlanReparacionWinston
  try {
    plan = await construirPlanReparacionWinston(db, {
      excluirPagoIds: noguera.excluirPagoIds,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const audit = await auditarFoliosWinstonGeneral(db)
    return {
      ok: true,
      aplicada: false,
      cambios: 0,
      canceladosDuplicados,
      siguienteFolio: FOLIO_REPARACION_WINSTON_INICIO,
      revisados: 0,
      ancla: { pago_id: 0, folio: FOLIO_REPARACION_WINSTON_ULTIMO_OK, fecha: '' },
      detalle: cancelDetalle,
      audit,
      series: {
        winston_general: FOLIO_REPARACION_WINSTON_INICIO,
        winston_cuota: 0,
        educativo_general: 0,
        educativo_cuota: 0,
      },
      mensaje: msg,
    }
  }

  if (opts?.cancelarDuplicados !== false) {
    const dup = await cancelarCapturasDuplicadasWinston(db, {
      dryRun,
      fechaMin: FECHA_REPARACION_WINSTON_DESDE,
    })
    canceladosDuplicados += dup.cancelados
    cancelDetalle.push(...dup.detalle)
    if ((canceladosDuplicados > 0 || noguera.cancelados > 0) && !dryRun) {
      plan = await construirPlanReparacionWinston(db, {
        excluirPagoIds: noguera.excluirPagoIds,
      })
    }
  }

  const { asignaciones, aReparar, anclaRow, anclaId, anclaFecha, siguienteEsperado, sombrasFueraDeTalon } =
    plan

  const detalle: string[] = [...cancelDetalle]
  let cambios = 0

  if (!dryRun && sombrasFueraDeTalon.length > 0) {
    for (const s of sombrasFueraDeTalon) {
      const temp = FOLIO_TEMP_BASE + Number(s.pago_id)
      detalle.push(
        `sombra dedupe pago_id=${s.pago_id} folio ${s.pago_folio}→${temp} (fuera del talón)`
      )
      const { error } = await db
        .from('pago_interno')
        .update({ pago_folio: temp, pago_actualizacion: new Date().toISOString() })
        .eq('pago_id', s.pago_id)
      if (error) throw new Error(`Sombra pago_id ${s.pago_id}: ${error.message}`)
    }
  } else if (dryRun) {
    for (const s of sombrasFueraDeTalon.slice(0, 20)) {
      detalle.push(
        `[dry-run] sombra dedupe pago_id=${s.pago_id} folio ${s.pago_folio}→${FOLIO_TEMP_BASE + Number(s.pago_id)}`
      )
    }
  }

  if (!dryRun && asignaciones.length > 0) {
    for (const c of asignaciones) {
      const temp = FOLIO_TEMP_BASE + c.pago_id
      const { error } = await db
        .from('pago_interno')
        .update({ pago_folio: temp })
        .eq('pago_id', c.pago_id)
      if (error) throw new Error(`Temp pago_id ${c.pago_id}: ${error.message}`)
    }
    for (const c of asignaciones) {
      const { error } = await db
        .from('pago_interno')
        .update({ pago_folio: c.a })
        .eq('pago_id', c.pago_id)
      if (error) throw new Error(`Final pago_id ${c.pago_id}: ${error.message}`)
      cambios += 1
      if (detalle.length < 80) {
        detalle.push(`pago_id=${c.pago_id} ${c.de}→${c.a} (${c.fecha})`)
      }
    }
  } else if (dryRun) {
    for (const c of asignaciones.slice(0, 50)) {
      detalle.push(`[dry-run] pago_id=${c.pago_id} ${c.de}→${c.a} (${c.fecha})`)
    }
    cambios = asignaciones.length
  }

  const audit = await auditarFoliosWinstonGeneral(db)
  const winstonGeneralSiguiente = dryRun
    ? siguienteEsperado
    : await obtenerSiguienteFolioPago('winston', 'general', db)
  const series = {
    winston_general: winstonGeneralSiguiente,
    winston_cuota: dryRun ? 0 : await obtenerSiguienteFolioPago('winston', 'cuota_padres', db),
    educativo_general: dryRun ? 0 : await obtenerSiguienteFolioPago('educativo', 'general', db),
    educativo_cuota: dryRun ? 0 : await obtenerSiguienteFolioPago('educativo', 'cuota_padres', db),
  }

  const aplicada = cambios > 0 || canceladosDuplicados > 0

  return {
    ok: true,
    aplicada,
    cambios,
    canceladosDuplicados,
    siguienteFolio: winstonGeneralSiguiente,
    revisados: aReparar.length,
    ancla: {
      pago_id: anclaId,
      folio: Number(anclaRow.pago_folio),
      fecha: anclaFecha,
    },
    detalle,
    audit,
    series,
    mensaje: aplicada
      ? `Reparado: ${cambios} folio(s), ${canceladosDuplicados} duplicado(s) cancelado(s). Winston general→${series.winston_general}.`
      : `Consecutivo OK (${aReparar.length} pagos). Winston general→${series.winston_general}. Duplicados folio: ${audit.duplicadosFolio.length}.`,
  }
}
