import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/boletasApi'
import { capturaConfigDeSlug, cookieSesionCapturaBorrar } from '@/lib/boletasCapturaAuth'

type Params = { params: Promise<{ slug: string }> }

export async function POST(_req: Request, { params }: Params) {
  try {
    const cfg = capturaConfigDeSlug((await params).slug)
    const res = NextResponse.json({ ok: true })
    res.cookies.set(cookieSesionCapturaBorrar(cfg))
    return res
  } catch (e) {
    return jsonError(e)
  }
}
