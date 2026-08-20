import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  auditarFoliosWinstonGeneral,
  diagnosticarFoliosWinstonGeneralInsforge,
  repararFoliosWinstonGeneralInsforge,
} from '@/lib/repararFoliosWinstonInsforge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET ?audit=1 — duplicados y folios puntuales.
 * GET ?diagnostico=1&desde=2026-08-13 — reporte detallado 13-ago → hoy.
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
