import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  CONCEPTOS_CUOTA_PADRES,
  CONCEPTO_ID_MANUALES,
  FOLIO_REPARACION_WINSTON_INICIO,
} from '@/lib/pagoInternoService'
import {
  PAGO_INTERNO_FOLIO_WINSTON_INICIAL,
  PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN,
  plantelPagoDesdeNivel,
} from '@/lib/pagoInternoPlantel'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SELECT_PAGO =
  'pago_id, alumno_id, concepto_id, concepto_otro, pago_folio, pago_importe, pago_fecha, pago_cancelado, pago_ciclo_escolar, pago_registro'

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

/**
 * POST/GET: revalida consecutivo Winston general desde 2848 (admin DB).
 * Llamado al abrir Pagos internos; idempotente.
 */
async function handle() {
  const db = createDbAdmin()

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
    if (err2) {
      return NextResponse.json({ ok: false, mensaje: err2.message }, { status: 500 })
    }
    alumnos = todos ?? []
  }

  const arvizu = alumnos.filter((a) =>
    nombreEsEduardoArvizu(a.alumno_nombre, a.alumno_app, a.alumno_apm)
  )
  if (!arvizu.length) {
    return NextResponse.json({
      ok: true,
      aplicada: false,
      cambios: 0,
      mensaje: 'No se encontró alumno EDUARDO ARVIZU.',
    })
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

  if (errMan) {
    return NextResponse.json({ ok: false, mensaje: errMan.message }, { status: 500 })
  }
  if (!manualesArvizu?.length) {
    return NextResponse.json({
      ok: true,
      aplicada: false,
      cambios: 0,
      mensaje: 'ARVIZU no tiene MANUALES vigente.',
    })
  }

  const ancla =
    manualesArvizu.find((p) => Number(p.pago_folio) === FOLIO_REPARACION_WINSTON_INICIO) ??
    manualesArvizu.find((p) => Number(p.pago_folio) === PAGO_INTERNO_FOLIO_WINSTON_INICIAL) ??
    manualesArvizu[0]

  const anclaFecha = String(ancla.pago_fecha ?? '')
  const anclaId = Number(ancla.pago_id)
  if (!anclaFecha) {
    return NextResponse.json(
      { ok: false, mensaje: `MANUALES pago_id=${anclaId} sin fecha` },
      { status: 500 }
    )
  }

  const pageSize = 1000
  const porFecha: Record<string, unknown>[] = []
  let from = 0
  for (;;) {
    const { data, error } = await db
      .from('pago_interno')
      .select(SELECT_PAGO)
      .gte('pago_fecha', anclaFecha)
      .eq('pago_cancelado', 0)
      .order('pago_fecha', { ascending: true })
      .order('pago_id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) {
      return NextResponse.json({ ok: false, mensaje: error.message }, { status: 500 })
    }
    const batch = data ?? []
    porFecha.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }

  const { data: stuck2671, error: errStuck } = await db
    .from('pago_interno')
    .select(SELECT_PAGO)
    .eq('pago_folio', PAGO_INTERNO_FOLIO_WINSTON_INICIAL)
    .eq('pago_cancelado', 0)
    .limit(500)
  if (errStuck) {
    return NextResponse.json({ ok: false, mensaje: errStuck.message }, { status: 500 })
  }

  const porId = new Map<number, Record<string, unknown>>()
  for (const p of [...porFecha, ...(stuck2671 ?? [])]) {
    const conceptoId = Number(p.concepto_id)
    if (esCuota(conceptoId)) continue
    const folio = Number(p.pago_folio)
    const enSerie =
      folio >= PAGO_INTERNO_FOLIO_WINSTON_INICIAL &&
      folio < PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN
    if (!enSerie) continue
    const fecha = String(p.pago_fecha ?? '')
    const pagoId = Number(p.pago_id)
    if (fecha > anclaFecha || (fecha === anclaFecha && pagoId >= anclaId)) {
      porId.set(pagoId, p)
    }
  }
  porId.set(anclaId, ancla)

  const alumnoIds = [
    ...new Set(
      [...porId.values()]
        .map((p) => Number(p.alumno_id))
        .filter((id) => Number.isFinite(id))
    ),
  ]
  const nivelPorAlumno = new Map<number, number>()
  for (let i = 0; i < alumnoIds.length; i += 200) {
    const slice = alumnoIds.slice(i, i + 200)
    const { data: alums, error } = await db
      .from('alumno')
      .select('alumno_id, alumno_nivel')
      .in('alumno_id', slice)
    if (error) {
      return NextResponse.json({ ok: false, mensaje: error.message }, { status: 500 })
    }
    for (const a of alums ?? []) {
      nivelPorAlumno.set(Number(a.alumno_id), Number(a.alumno_nivel) || 0)
    }
  }

  const aReparar = [...porId.values()]
    .filter((p) => {
      if (Number(p.pago_id) === anclaId) return true
      const nivel = nivelPorAlumno.get(Number(p.alumno_id))
      if (nivel == null) return true
      return plantelPagoDesdeNivel(nivel) === 'winston'
    })
    .sort((a, b) => {
      const fa = String(a.pago_fecha ?? '')
      const fb = String(b.pago_fecha ?? '')
      if (fa !== fb) return fa < fb ? -1 : 1
      return Number(a.pago_id) - Number(b.pago_id)
    })

  let folio = FOLIO_REPARACION_WINSTON_INICIO
  let cambios = 0
  const detalle: string[] = []
  for (const p of aReparar) {
    const actual = Number(p.pago_folio)
    const pagoId = Number(p.pago_id)
    if (actual !== folio) {
      const { error } = await db
        .from('pago_interno')
        .update({ pago_folio: folio })
        .eq('pago_id', pagoId)
      if (error) {
        return NextResponse.json(
          {
            ok: false,
            mensaje: `Error pago_id ${pagoId} (${actual}→${folio}): ${error.message}`,
          },
          { status: 500 }
        )
      }
      cambios += 1
      if (detalle.length < 40) {
        detalle.push(`pago_id=${pagoId} ${actual}→${folio} (${p.pago_fecha})`)
      }
    }
    folio += 1
  }

  // Diagnóstico: máximos del talón actual (excluye legacy ≥4000).
  const { data: maxRows } = await db
    .from('pago_interno')
    .select('pago_folio, concepto_id, alumno_id')
    .gte('pago_folio', PAGO_INTERNO_FOLIO_WINSTON_INICIAL)
    .lt('pago_folio', PAGO_INTERNO_FOLIO_WINSTON_LEGACY_MIN)
    .not('concepto_id', 'in', `(${[...CONCEPTOS_CUOTA_PADRES].join(',')})`)
    .order('pago_folio', { ascending: false })
    .limit(8)
  const maxSerie = Number(maxRows?.[0]?.pago_folio) || null

  return NextResponse.json({
    ok: true,
    aplicada: cambios > 0,
    cambios,
    siguienteFolio: folio,
    maxSerieWinstonGeneral: maxSerie,
    siguienteSegunMax: maxSerie != null ? maxSerie + 1 : FOLIO_REPARACION_WINSTON_INICIO,
    topFolios: (maxRows ?? []).map((r) => ({
      folio: Number(r.pago_folio),
      concepto_id: Number(r.concepto_id),
      alumno_id: Number(r.alumno_id),
    })),
    revisados: aReparar.length,
    ancla: {
      pago_id: anclaId,
      folio_antes: Number(ancla.pago_folio),
      fecha: anclaFecha,
    },
    detalle,
    mensaje:
      cambios > 0
        ? `Consecutivo desde 2848 corregido: ${cambios} pago(s). Siguiente=${folio}.`
        : `Consecutivo desde 2848 OK (${aReparar.length} revisados). Siguiente=${folio}.`,
  })
}

export async function GET() {
  return handle()
}

export async function POST() {
  return handle()
}
