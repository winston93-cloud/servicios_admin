import { NextResponse } from 'next/server'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { archivarPagoInternoLegacyInsforge } from '@/lib/archivarPagoInternoLegacy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET — inventario / dry-run (no escribe).
 * POST — archiva a pago_interno_old y borra de pago_interno.
 * POST ?dryRun=1 — simula sin escribir.
 *
 * Requiere tabla pago_interno_old (sql/pago_interno_old.sql en InsForge).
 */
export async function GET() {
  try {
    const db = createDbAdmin()
    const res = await archivarPagoInternoLegacyInsforge(db, { dryRun: true })
    return NextResponse.json(res)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al inventariar legacy'
    console.error('GET /api/servicios/archivar-pago-interno-legacy:', e)
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
    const res = await archivarPagoInternoLegacyInsforge(db, { dryRun })
    return NextResponse.json(res, { status: res.ok ? 200 : 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al archivar legacy'
    console.error('POST /api/servicios/archivar-pago-interno-legacy:', e)
    return NextResponse.json({ ok: false, mensaje: msg }, { status: 500 })
  }
}
