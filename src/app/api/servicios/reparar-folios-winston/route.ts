import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  auditarFoliosWinstonGeneral,
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
 * POST — aplica reparación Winston general desde 2848 (no cuota padres).
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
    try {
      const body = await request.json().catch(() => ({}))
      if (body && typeof body === 'object' && 'dryRun' in body) {
        dryRun = Boolean((body as { dryRun?: boolean }).dryRun)
      }
    } catch {
      /* sin body */
    }

    const db = createDbAdmin()
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
