import { NextResponse } from 'next/server'
import { listarTramitesAdministrativos } from '@/lib/controlEscolarTramitesService'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const data = await listarTramitesAdministrativos()
    return NextResponse.json({ ok: true, ...data })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error en el sistema'
    console.error('API control-escolar/tramites:', e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
