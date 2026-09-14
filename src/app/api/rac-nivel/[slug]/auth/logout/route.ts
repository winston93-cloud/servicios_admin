import { NextResponse } from 'next/server'
import {
  cfgDesdeRequestSlug,
  jsonRacNivelError,
  opcionesCookieRacNivelClear,
} from '@/lib/rac/racAuthNivel'

type Params = { params: Promise<{ slug: string }> }

export async function POST(_req: Request, { params }: Params) {
  try {
    const { slug } = await params
    const cfg = cfgDesdeRequestSlug(slug)
    const res = NextResponse.json({ ok: true })
    res.cookies.set(opcionesCookieRacNivelClear(cfg))
    return res
  } catch (e) {
    const { error, status } = jsonRacNivelError(e)
    return NextResponse.json({ error }, { status })
  }
}
