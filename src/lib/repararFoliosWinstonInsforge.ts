/**
 * Reparación idempotente del consecutivo Winston general (no cuota de padres)
 * desde el ancla ARVIZU / folio 2848. Usa folios temporales altos para evitar
 * choques al renumerar in-place (p. ej. dos pagos en 2880).
 */
import type { AppDatabaseClient } from '@/lib/dbTypes'
import {
  CONCEPTOS_CUOTA_PADRES,
  CONCEPTO_ID_MANUALES,
  FOLIO_REPARACION_WINSTON_INICIO,
  obtenerSiguienteFolioPago,
} from '@/lib/pagoInternoService'
import {
  PAGO_INTERNO_FOLIO_WINSTON_INICIAL,
  PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN,
  plantelPagoDesdeNivel,
} from '@/lib/pagoInternoPlantel'

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
      .eq('pago_cancelado', 0)
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

async function nivelesPorAlumno(
  db: AppDatabaseClient,
  alumnoIds: number[]
): Promise<Map<number, number>> {
  const map = new Map<number, number>()
  for (let i = 0; i < alumnoIds.length; i += 200) {
    const slice = alumnoIds.slice(i, i + 200)
    const { data, error } = await db
      .from('alumno')
      .select('alumno_id, alumno_nivel')
      .in('alumno_id', slice)
    if (error) throw new Error(error.message)
    for (const a of data ?? []) {
      map.set(Number(a.alumno_id), Number(a.alumno_nivel) || 0)
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
      map.set(Number(a.alumno_id), {
        ref: a.alumno_ref != null ? String(a.alumno_ref) : null,
        nombre: nombreCompletoUpper(a.alumno_nombre, a.alumno_app, a.alumno_apm),
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
  foliosConsulta: number[] = [2880, 2919, 2920]
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
  const [niveles, alumnos] = await Promise.all([
    nivelesPorAlumno(db, alumnoIds),
    enriquecerAlumnos(db, alumnoIds),
  ])

  const winston = rows.filter((p) => {
    const nivel = p.alumno_id != null ? niveles.get(Number(p.alumno_id)) : null
    if (nivel == null) return true
    return plantelPagoDesdeNivel(nivel) === 'winston'
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
  opts?: { dryRun?: boolean; alumnoNombre?: string }
): Promise<{ cancelados: number; detalle: string[] }> {
  const dryRun = opts?.dryRun ?? false
  let alumnoIds: number[] | null = null
  if (opts?.alumnoNombre) {
    alumnoIds = await buscarAlumnoIdsPorNombre(db, opts.alumnoNombre)
    if (alumnoIds.length === 0) return { cancelados: 0, detalle: [] }
  }

  const { data, error } = await db
    .from('pago_interno')
    .select(SELECT_PAGO)
    .gte('pago_folio', FOLIO_REPARACION_WINSTON_INICIO)
    .lt('pago_folio', PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN)
    .eq('pago_cancelado', 0)
    .order('pago_id', { ascending: true })
    .limit(5000)
  if (error) throw new Error(error.message)

  let rows = ((data ?? []) as PagoInternoRow[]).filter((p) => !esCuota(p.concepto_id))
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

/** Repara consecutivo Winston general desde 2848 (dos fases). */
export async function repararFoliosWinstonGeneralInsforge(
  db: AppDatabaseClient,
  opts?: { dryRun?: boolean; cancelarDuplicados?: boolean }
): Promise<ResultadoReparacionWinstonInsforge> {
  const dryRun = opts?.dryRun ?? false
  let canceladosDuplicados = 0
  const cancelDetalle: string[] = []

  if (opts?.cancelarDuplicados !== false) {
    const dup = await cancelarCapturasDuplicadasWinston(db, {
      dryRun,
      alumnoNombre: 'RAHI RAMIREZ RIVERA',
    })
    canceladosDuplicados += dup.cancelados
    cancelDetalle.push(...dup.detalle)
  }

  const { data: alumnosApp, error: errAlum } = await db
    .from('alumno')
    .select('alumno_id, alumno_nombre, alumno_app, alumno_apm, alumno_nivel')
    .ilike('alumno_app', '%ARVIZU%')
    .limit(100)

  let alumnos = alumnosApp ?? []
  if (errAlum) {
    const { data: todos, error: err2 } = await db
      .from('alumno')
      .select('alumno_id, alumno_nombre, alumno_app, alumno_apm, alumno_nivel')
      .limit(8000)
    if (err2) throw new Error(err2.message)
    alumnos = todos ?? []
  }

  const arvizu = alumnos.filter((a) =>
    nombreEsEduardoArvizu(a.alumno_nombre, a.alumno_app, a.alumno_apm)
  )
  if (!arvizu.length) {
    const audit = await auditarFoliosWinstonGeneral(db)
    return {
      ok: true,
      aplicada: canceladosDuplicados > 0,
      cambios: 0,
      canceladosDuplicados,
      siguienteFolio: FOLIO_REPARACION_WINSTON_INICIO,
      revisados: 0,
      ancla: { pago_id: 0, folio: 0, fecha: '' },
      detalle: cancelDetalle,
      audit,
      series: {
        winston_general: FOLIO_REPARACION_WINSTON_INICIO,
        winston_cuota: 0,
        educativo_general: 0,
        educativo_cuota: 0,
      },
      mensaje: 'No se encontró alumno EDUARDO ARVIZU.',
    }
  }

  const arvizuIds = arvizu.map((a) => Number(a.alumno_id))
  const { data: manualesArvizu, error: errMan } = await db
    .from('pago_interno')
    .select(SELECT_PAGO)
    .eq('concepto_id', CONCEPTO_ID_MANUALES)
    .eq('pago_cancelado', 0)
    .in('alumno_id', arvizuIds)
    .order('pago_fecha', { ascending: true })
    .order('pago_id', { ascending: true })
    .limit(20)

  if (errMan) throw new Error(errMan.message)
  if (!manualesArvizu?.length) {
    throw new Error('ARVIZU no tiene MANUALES vigente.')
  }

  const anclaRow =
    manualesArvizu.find((p) => Number(p.pago_folio) === FOLIO_REPARACION_WINSTON_INICIO) ??
    manualesArvizu.find((p) => Number(p.pago_folio) === PAGO_INTERNO_FOLIO_WINSTON_INICIAL) ??
    manualesArvizu[0]

  const anclaFecha = String(anclaRow.pago_fecha ?? '')
  const anclaId = Number(anclaRow.pago_id)
  if (!anclaFecha) throw new Error(`MANUALES pago_id=${anclaId} sin fecha`)

  const porFecha = await fetchPagosDesdeFecha(db, anclaFecha)
  const stuck2671 = await fetchStuck2671(db)

  const porId = new Map<number, PagoInternoRow>()
  for (const p of [...porFecha, ...stuck2671]) {
    if (esCuota(Number(p.concepto_id))) continue
    const folio = Number(p.pago_folio)
    const enSerie =
      folio >= PAGO_INTERNO_FOLIO_WINSTON_INICIAL &&
      folio < PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN
    if (!enSerie) continue
    const fecha = String(p.pago_fecha ?? '')
    const pagoId = Number(p.pago_id)
    if (fecha > anclaFecha || (fecha === anclaFecha && pagoId >= anclaId)) {
      porId.set(pagoId, p as PagoInternoRow)
    }
  }
  porId.set(anclaId, anclaRow as PagoInternoRow)

  const alumnoIds = [...new Set([...porId.values()].map((p) => Number(p.alumno_id)).filter(Boolean))]
  const nivelPorAlumno = await nivelesPorAlumno(db, alumnoIds)

  const aReparar = [...porId.values()]
    .filter((p) => {
      if (Number(p.pago_id) === anclaId) return true
      const nivel = p.alumno_id != null ? nivelPorAlumno.get(Number(p.alumno_id)) : null
      if (nivel == null) return true
      return plantelPagoDesdeNivel(nivel) === 'winston'
    })
    .sort((a, b) => {
      const fa = String(a.pago_fecha ?? '')
      const fb = String(b.pago_fecha ?? '')
      if (fa !== fb) return fa < fb ? -1 : 1
      return Number(a.pago_id) - Number(b.pago_id)
    })

  const asignaciones: { pago_id: number; de: number; a: number; fecha: string | null }[] = []
  let folio = FOLIO_REPARACION_WINSTON_INICIO
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

  const detalle: string[] = [...cancelDetalle]
  let cambios = 0

  if (!dryRun && asignaciones.length > 0) {
    // Fase 1: folios temporales (evita choque 2880→2881 con otro 2881 vigente)
    for (const c of asignaciones) {
      const temp = FOLIO_TEMP_BASE + c.pago_id
      const { error } = await db
        .from('pago_interno')
        .update({ pago_folio: temp })
        .eq('pago_id', c.pago_id)
      if (error) throw new Error(`Temp pago_id ${c.pago_id}: ${error.message}`)
    }
    // Fase 2: folio definitivo
    for (const c of asignaciones) {
      const { error } = await db
        .from('pago_interno')
        .update({ pago_folio: c.a })
        .eq('pago_id', c.pago_id)
      if (error) throw new Error(`Final pago_id ${c.pago_id}: ${error.message}`)
      cambios += 1
      if (detalle.length < 50) {
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
  const series = {
    winston_general: dryRun
      ? folio
      : await obtenerSiguienteFolioPago('winston', 'general'),
    winston_cuota: dryRun ? 0 : await obtenerSiguienteFolioPago('winston', 'cuota_padres'),
    educativo_general: dryRun ? 0 : await obtenerSiguienteFolioPago('educativo', 'general'),
    educativo_cuota: dryRun ? 0 : await obtenerSiguienteFolioPago('educativo', 'cuota_padres'),
  }

  const aplicada = cambios > 0 || canceladosDuplicados > 0

  return {
    ok: true,
    aplicada,
    cambios,
    canceladosDuplicados,
    siguienteFolio: folio,
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
