import { NextResponse } from 'next/server'
import { confirmarPublico, detallePublico } from '@/lib/racService'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const id = String(url.searchParams.get('id') ?? '')
    const alt = Number(url.searchParams.get('alt') ?? 1)
    if (!id) return NextResponse.json({ error: 'Folio no válido' }, { status: 400 })
    const detalle = await detallePublico(id, alt)
    if (!detalle) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json(detalle)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { id?: string; alt?: number }
    const id = String(body.id ?? '')
    const alt = Number(body.alt ?? 1)
    if (!id) return NextResponse.json({ error: 'Folio no válido' }, { status: 400 })
    await confirmarPublico(id, alt)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
