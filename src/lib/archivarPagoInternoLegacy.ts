/**
 * Archiva filas legacy de pago_interno → pago_interno_old y las elimina
 * de la tabla activa para que no interfieran con el tip del talón actual.
 *
 * Qué se archiva:
 * - folio ≥ 4000 (incluye 5xxx–7xxx y talón anterior 26550+)
 * - folio 3480–3999 (hueco entre techo Educativo y legacy)
 * - folio 3200–3479 con pago_fecha < 2026-01-01 (histórico en zona de solape)
 *
 * Qué NO se toca (series current):
 * - Winston general vivo (~2671…tip actual)
 * - Cuota Winston / Educativo
 * - Educativo general 2026 (2849–3479 con fecha ≥ 2026)
 * - Folios temp 9xxxxx de reparaciones recientes
 */
import type { AppDatabaseClient } from '@/lib/dbTypes'
import {
  PAGO_INTERNO_FOLIO_EDUCATIVO_TECHO,
  PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN,
  PAGO_INTERNO_WINSTON_TALON_ACTUAL_DESDE,
} from '@/lib/pagoInternoPlantel'

const SELECT_PAGO =
  'pago_id, alumno_id, concepto_id, concepto_otro, pago_folio, pago_importe, pago_fecha, pago_cancelado, pago_ciclo_escolar, pago_registro, pago_actualizacion'

export type PagoInternoLegacyRow = {
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
  pago_actualizacion: string | null
}

/** Folios ≥3200 pueden ser Educativo current; solo archivar si son viejos. */
const FOLIO_SOLAPE_EDUCATIVO_MIN = 3200

export function esPagoInternoLegacy(row: {
  pago_folio: number
  pago_fecha?: string | null
}): boolean {
  const folio = Number(row.pago_folio)
  if (!Number.isFinite(folio)) return false
  // Temp de reparación: no archivar aquí (otra limpieza).
  if (folio >= 900_000) return false
  if (folio >= PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN) return true
  if (folio >= PAGO_INTERNO_FOLIO_EDUCATIVO_TECHO && folio < PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN) {
    return true
  }
  if (folio >= FOLIO_SOLAPE_EDUCATIVO_MIN && folio < PAGO_INTERNO_FOLIO_EDUCATIVO_TECHO) {
    const fecha = String(row.pago_fecha ?? '').slice(0, 10)
    return Boolean(fecha && fecha < PAGO_INTERNO_WINSTON_TALON_ACTUAL_DESDE)
  }
  return false
}

async function fetchBand(
  db: AppDatabaseClient,
  opts: { gte: number; lt?: number; fechaLt?: string }
): Promise<PagoInternoLegacyRow[]> {
  const pageSize = 1000
  const out: PagoInternoLegacyRow[] = []
  let from = 0
  for (;;) {
    let q = db
      .from('pago_interno')
      .select(SELECT_PAGO)
      .gte('pago_folio', opts.gte)
      .order('pago_folio', { ascending: true })
      .order('pago_id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (opts.lt != null) q = q.lt('pago_folio', opts.lt)
    if (opts.fechaLt) q = q.lt('pago_fecha', opts.fechaLt)

    const { data, error } = await q
    if (error) throw new Error(`Listar legacy: ${error.message}`)
    const batch = (data ?? []) as PagoInternoLegacyRow[]
    out.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return out
}

export async function listarPagosInternosLegacy(
  db: AppDatabaseClient
): Promise<PagoInternoLegacyRow[]> {
  const [ge4000, mid3480, old3200] = await Promise.all([
    fetchBand(db, { gte: PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN }),
    fetchBand(db, {
      gte: PAGO_INTERNO_FOLIO_EDUCATIVO_TECHO,
      lt: PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN,
    }),
    fetchBand(db, {
      gte: FOLIO_SOLAPE_EDUCATIVO_MIN,
      lt: PAGO_INTERNO_FOLIO_EDUCATIVO_TECHO,
      fechaLt: PAGO_INTERNO_WINSTON_TALON_ACTUAL_DESDE,
    }),
  ])

  const byId = new Map<number, PagoInternoLegacyRow>()
  for (const row of [...ge4000, ...mid3480, ...old3200]) {
    if (!esPagoInternoLegacy(row)) continue
    byId.set(Number(row.pago_id), row)
  }
  return [...byId.values()].sort(
    (a, b) => a.pago_folio - b.pago_folio || a.pago_id - b.pago_id
  )
}

export type ResumenArchivoLegacy = {
  ok: boolean
  dryRun: boolean
  tablaOldExiste: boolean
  candidatos: number
  archivados: number
  eliminados: number
  folioMin: number | null
  folioMax: number | null
  muestra: Array<{ pago_id: number; pago_folio: number; pago_fecha: string | null }>
  mensaje: string
  sqlCrearTabla?: string
}

export async function tablaPagoInternoOldExiste(
  db: AppDatabaseClient
): Promise<boolean> {
  const { error } = await db.from('pago_interno_old').select('pago_id').limit(1)
  if (!error) return true
  const msg = (error.message ?? '').toLowerCase()
  if (msg.includes('does not exist') || msg.includes('not find') || msg.includes('schema cache')) {
    return false
  }
  // Otros errores (RLS, etc.) → asumir que existe y fallará al insertar.
  return true
}

export async function archivarPagoInternoLegacyInsforge(
  db: AppDatabaseClient,
  opts?: { dryRun?: boolean }
): Promise<ResumenArchivoLegacy> {
  const dryRun = opts?.dryRun !== false
  const candidatos = await listarPagosInternosLegacy(db)
  const folioMin = candidatos.length ? candidatos[0]!.pago_folio : null
  const folioMax = candidatos.length
    ? candidatos[candidatos.length - 1]!.pago_folio
    : null
  const muestra = candidatos.slice(0, 8).map((r) => ({
    pago_id: r.pago_id,
    pago_folio: r.pago_folio,
    pago_fecha: r.pago_fecha,
  }))

  const tablaOldExiste = await tablaPagoInternoOldExiste(db)
  if (!tablaOldExiste) {
    return {
      ok: false,
      dryRun,
      tablaOldExiste: false,
      candidatos: candidatos.length,
      archivados: 0,
      eliminados: 0,
      folioMin,
      folioMax,
      muestra,
      mensaje:
        'Falta la tabla pago_interno_old. Ejecuta sql/pago_interno_old.sql en InsForge (Winston Servicios) y reintenta.',
      sqlCrearTabla: 'sql/pago_interno_old.sql',
    }
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      tablaOldExiste: true,
      candidatos: candidatos.length,
      archivados: 0,
      eliminados: 0,
      folioMin,
      folioMax,
      muestra,
      mensaje: `Dry-run: ${candidatos.length} fila(s) legacy a archivar (folios ${folioMin}–${folioMax}).`,
    }
  }

  if (candidatos.length === 0) {
    return {
      ok: true,
      dryRun: false,
      tablaOldExiste: true,
      candidatos: 0,
      archivados: 0,
      eliminados: 0,
      folioMin: null,
      folioMax: null,
      muestra: [],
      mensaje: 'No hay filas legacy que archivar.',
    }
  }

  const ahora = new Date().toISOString()
  const chunk = 200
  let archivados = 0
  let eliminados = 0

  for (let i = 0; i < candidatos.length; i += chunk) {
    const slice = candidatos.slice(i, i + chunk)
    const payload = slice.map((r) => ({
      pago_id: r.pago_id,
      alumno_id: r.alumno_id,
      concepto_id: r.concepto_id,
      concepto_otro: r.concepto_otro,
      pago_folio: r.pago_folio,
      pago_importe: r.pago_importe,
      pago_fecha: r.pago_fecha,
      pago_cancelado: r.pago_cancelado,
      pago_ciclo_escolar: r.pago_ciclo_escolar,
      pago_registro: r.pago_registro,
      pago_actualizacion: r.pago_actualizacion ?? ahora,
      archivado_en: ahora,
    }))

    const { error: insErr } = await db.from('pago_interno_old').upsert(payload, {
      onConflict: 'pago_id',
    })
    if (insErr) {
      return {
        ok: false,
        dryRun: false,
        tablaOldExiste: true,
        candidatos: candidatos.length,
        archivados,
        eliminados,
        folioMin,
        folioMax,
        muestra,
        mensaje: `Error al insertar en pago_interno_old (chunk ${i}): ${insErr.message}`,
      }
    }
    archivados += slice.length

    const ids = slice.map((r) => r.pago_id)
    const { error: delErr } = await db.from('pago_interno').delete().in('pago_id', ids)
    if (delErr) {
      return {
        ok: false,
        dryRun: false,
        tablaOldExiste: true,
        candidatos: candidatos.length,
        archivados,
        eliminados,
        folioMin,
        folioMax,
        muestra,
        mensaje: `Archivado en old, pero falló delete en pago_interno (chunk ${i}): ${delErr.message}`,
      }
    }
    eliminados += ids.length
  }

  return {
    ok: true,
    dryRun: false,
    tablaOldExiste: true,
    candidatos: candidatos.length,
    archivados,
    eliminados,
    folioMin,
    folioMax,
    muestra,
    mensaje: `Archivadas ${archivados} fila(s) → pago_interno_old; eliminadas ${eliminados} de pago_interno (folios ${folioMin}–${folioMax}).`,
  }
}
