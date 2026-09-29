import { NextResponse } from 'next/server'
import { responderError, verificarPin } from '@/lib/enlacesX/enlacesXService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    await verificarPin(request)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return responderError(e, 'POST /api/enlaces-x/pin:')
  }
}
