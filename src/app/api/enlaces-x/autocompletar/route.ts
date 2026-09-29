import { NextResponse } from 'next/server'
import { autocompletarEnlace, responderError, verificarPin } from '@/lib/enlacesX/enlacesXService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 45

export async function POST(request: Request) {
  try {
    await verificarPin(request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return NextResponse.json({ borrador: await autocompletarEnlace(body.url) })
  } catch (e) {
    return responderError(e, 'POST /api/enlaces-x/autocompletar:')
  }
}
