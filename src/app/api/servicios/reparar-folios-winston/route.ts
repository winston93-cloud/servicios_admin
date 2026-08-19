import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  auditarFoliosWinstonGeneral,
  repararFoliosWinstonGeneralInsforge,
} from '@/lib/repararFoliosWinstonInsforge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET ?audit=1 — solo diagnóstico (duplicados, folios 2880/2919/2920).
 * GET/POST ?dryRun=1 — simula renumeración + cancelación RAHI.
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
