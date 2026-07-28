import { NextResponse } from 'next/server'
import { listarPanelDocumentacionControlEscolar } from '@/lib/controlEscolarPanelService'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const panel = await listarPanelDocumentacionControlEscolar()
    return NextResponse.json({ ok: true, ...panel })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error en el sistema'
    console.error('API control-escolar/panel:', e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
