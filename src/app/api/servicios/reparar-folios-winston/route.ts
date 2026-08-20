import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  auditarFoliosWinstonGeneral,
  cancelarRecorrerWinstonGeneralInsforge,
  compactarCuotaWinstonEliminarYRecorrerInsforge,
  desplazarWinstonGeneralDesdeInsforge,
  diagnosticarFoliosWinstonGeneralInsforge,
  listarAuditoriaFoliosWinston,
  listarPagosInternosPorFecha,
  repararFoliosWinstonGeneralInsforge,
} from '@/lib/repararFoliosWinstonInsforge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET ?audit=1 — duplicados y folios puntuales.
 * GET ?diagnostico=1&desde=2026-08-13 — reporte detallado 13-ago → hoy.
 * GET ?lista=1&desdeFolio=2886&limit=10 — auditoría talonario (bloques de N).
 * GET ?fecha=2026-08-01 — todos los pagos de ese día (folio asc).
 * GET/POST ?dryRun=1 — simula renumeración + cancelación duplicados.
 * POST ?eliminarCuotaPagoIds=20334,20336&cuotaDesplazarDesde=2404&cuotaDelta=-2 — cuota Winston.
 * POST ?cancelarRecorrerPagoId=20526 — stub cancelado en N y recorre Winston general +1.
 * POST — aplica reparación Winston general desde 2837 (continúa tras 2836; no cuota).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const db = createDbAdmin()

    if (searchParams.get('audit') === '1') {
      const audit = await auditarFoliosWinstonGeneral(db)
      return NextResponse.json({ ok: true, audit })
    }

    if (searchParams.get('diagnostico') === '1') {
      const desde = searchParams.get('desde') ?? '2026-08-13'
      const diagnostico = await diagnosticarFoliosWinstonGeneralInsforge(db, { desde })
      return NextResponse.json({ ok: true, diagnostico })
    }

    if (searchParams.get('lista') === '1') {
      const desdeFolio = Number(searchParams.get('desdeFolio') ?? '2886')
      const limit = Number(searchParams.get('limit') ?? '10')
      if (!Number.isFinite(desdeFolio) || desdeFolio < 1) {
        return NextResponse.json({ ok: false, mensaje: 'desdeFolio inválido' }, { status: 400 })
      }
      const lista = await listarAuditoriaFoliosWinston(db, {
        desdeFolio,
        limit: Number.isFinite(limit) ? limit : 10,
      })
      return NextResponse.json({ ok: true, lista })
    }

    const fecha = searchParams.get('fecha')
    if (fecha) {
      const porFecha = await listarPagosInternosPorFecha(db, { fecha })
      return NextResponse.json({ ok: true, porFecha })
    }

    const cancelarRecorrerPagoId = searchParams.get('cancelarRecorrerPagoId')
    if (cancelarRecorrerPagoId) {
      const res = await cancelarRecorrerWinstonGeneralInsforge(db, {
        pagoId: Number(cancelarRecorrerPagoId),
        dryRun: searchParams.get('dryRun') === '1',
      })
      return NextResponse.json(res, { status: res.ok ? 200 : 400 })
    }

    const moverFueraDeTalonPagoId = searchParams.get('moverFueraDeTalonPagoId')
    if (moverFueraDeTalonPagoId) {
      const id = Number(moverFueraDeTalonPagoId)
      if (!Number.isFinite(id) || id < 1) {
        return NextResponse.json({ ok: false, mensaje: 'pagoId inválido' }, { status: 400 })
      }
      const temp = 900_000 + id
      const { error } = await db
        .from('pago_interno')
        .update({ pago_folio: temp, pago_actualizacion: new Date().toISOString() })
        .eq('pago_id', id)
      if (error) {
        return NextResponse.json({ ok: false, mensaje: error.message }, { status: 500 })
      }
      return NextResponse.json({
        ok: true,
        pago_id: id,
        pago_folio: temp,
        mensaje: `pago_id ${id} → folio ${temp} (fuera del talón)`,
      })
    }

    const desplazarDesde = searchParams.get('desplazarDesde')
    const desplazarDelta = searchParams.get('delta')
    if (desplazarDesde && desplazarDelta) {
      const res = await desplazarWinstonGeneralDesdeInsforge(db, {
        desdeFolio: Number(desplazarDesde),
        delta: Number(desplazarDelta),
        dryRun: searchParams.get('dryRun') === '1',
      })
      return NextResponse.json(res, { status: res.ok ? 200 : 400 })
    }

    // Ajuste puntual: alinear pago_registro de un stub cancelado (recorrer).
    const fixStubRegistroId = searchParams.get('fixStubRegistroPagoId')
    const fixStubAntesDe = searchParams.get('antesDeRegistro')
    if (fixStubRegistroId && fixStubAntesDe) {
      const t = Date.parse(fixStubAntesDe)
      if (!Number.isFinite(t)) {
        return NextResponse.json({ ok: false, mensaje: 'antesDeRegistro inválido' }, { status: 400 })
      }
      const stubRegistro = new Date(t - 1).toISOString()
      const { error } = await db
        .from('pago_interno')
        .update({ pago_registro: stubRegistro })
        .eq('pago_id', Number(fixStubRegistroId))
        .eq('pago_cancelado', 1)
      if (error) {
        return NextResponse.json({ ok: false, mensaje: error.message }, { status: 500 })
      }
      return NextResponse.json({
        ok: true,
        pago_id: Number(fixStubRegistroId),
        pago_registro: stubRegistro,
        mensaje: `Stub ${fixStubRegistroId} registro→${stubRegistro}`,
      })
    }

    const dryRun = searchParams.get('dryRun') === '1'
    const res = await repararFoliosWinstonGeneralInsforge(db, {
      dryRun,
      cancelarDuplicados: searchParams.get('cancelarDuplicados') !== '0',
    })
    return NextResponse.json(res)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al reparar folios Winston'
    console.error('GET /api/servicios/reparar-folios-winston:', e)
    return NextResponse.json({ ok: false, mensaje: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    let dryRun = searchParams.get('dryRun') === '1'
    let cancelarRecorrerPagoId = searchParams.get('cancelarRecorrerPagoId')
    try {
      const body = await request.json().catch(() => ({}))
      if (body && typeof body === 'object') {
        if ('dryRun' in body) dryRun = Boolean((body as { dryRun?: boolean }).dryRun)
        if ('cancelarRecorrerPagoId' in body) {
          cancelarRecorrerPagoId = String(
            (body as { cancelarRecorrerPagoId?: string | number }).cancelarRecorrerPagoId ?? ''
          )
        }
      }
    } catch {
      /* sin body */
    }

    const db = createDbAdmin()

    if (cancelarRecorrerPagoId) {
      const res = await cancelarRecorrerWinstonGeneralInsforge(db, {
        pagoId: Number(cancelarRecorrerPagoId),
        dryRun,
      })
      return NextResponse.json(res, { status: res.ok ? 200 : 400 })
    }

    const eliminarCuotaIds = searchParams.get('eliminarCuotaPagoIds')
    const cuotaDesde = searchParams.get('cuotaDesplazarDesde')
    const cuotaDelta = searchParams.get('cuotaDelta')
    if (eliminarCuotaIds && cuotaDesde && cuotaDelta) {
      const res = await compactarCuotaWinstonEliminarYRecorrerInsforge(db, {
        eliminarPagoIds: eliminarCuotaIds.split(',').map((x) => Number(x.trim())),
        desplazarDesdeFolio: Number(cuotaDesde),
        delta: Number(cuotaDelta),
        dryRun,
      })
      return NextResponse.json(res, { status: res.ok ? 200 : 400 })
    }

    const desplazarDesde = searchParams.get('desplazarDesde')
    const desplazarDelta = searchParams.get('delta')
    if (desplazarDesde && desplazarDelta) {
      const res = await desplazarWinstonGeneralDesdeInsforge(db, {
        desdeFolio: Number(desplazarDesde),
        delta: Number(desplazarDelta),
        dryRun,
      })
      return NextResponse.json(res, { status: res.ok ? 200 : 400 })
    }

    const moverFueraDeTalonPagoId = searchParams.get('moverFueraDeTalonPagoId')
    if (moverFueraDeTalonPagoId) {
      const id = Number(moverFueraDeTalonPagoId)
      if (!Number.isFinite(id) || id < 1) {
        return NextResponse.json({ ok: false, mensaje: 'pagoId inválido' }, { status: 400 })
      }
      const temp = 900_000 + id
      const { error } = await db
        .from('pago_interno')
        .update({ pago_folio: temp, pago_actualizacion: new Date().toISOString() })
        .eq('pago_id', id)
      if (error) {
        return NextResponse.json({ ok: false, mensaje: error.message }, { status: 500 })
      }
      return NextResponse.json({
        ok: true,
        pago_id: id,
        pago_folio: temp,
        mensaje: `pago_id ${id} → folio ${temp} (fuera del talón)`,
      })
    }

    const res = await repararFoliosWinstonGeneralInsforge(db, {
      dryRun,
      cancelarDuplicados: searchParams.get('cancelarDuplicados') !== '0',
    })
    return NextResponse.json(res)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al reparar folios Winston'
    console.error('POST /api/servicios/reparar-folios-winston:', e)
    return NextResponse.json({ ok: false, mensaje: msg }, { status: 500 })
  }
}
