import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  listarUltimasVerificaciones,
  urlsWebhookOpenpay,
} from '@/lib/openpayWebhookService'
import type { OpenpayCuenta } from '@/lib/portalPagosSpei'

export const runtime = 'nodejs'

function baseUrlApp(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`
  return 'http://localhost:3000'
}

/** Últimos códigos de verificación OpenPay (para alta en dashboard). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cuentaParam = searchParams.get('cuenta')
  const cuenta =
    cuentaParam === 'winston' || cuentaParam === 'educativo'
      ? (cuentaParam as OpenpayCuenta)
      : undefined

  try {
    const supabase = createSupabaseAdmin()
    const verificaciones = await listarUltimasVerificaciones(supabase, cuenta, 10)
    const urls = urlsWebhookOpenpay(baseUrlApp())

    return NextResponse.json({
      ok: true,
      urls,
      verificaciones,
      instrucciones:
        'En OpenPay → Webhooks, pegar la URL del plantel y usar el código más reciente al verificar.',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al leer verificaciones'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
