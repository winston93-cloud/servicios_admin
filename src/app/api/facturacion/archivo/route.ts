import { NextResponse } from 'next/server'
import { createInsforgeAdmin } from '@/lib/insforgeAdmin'
import { CFDI_BUCKET } from '@/lib/cfdi/cfdiStorage'
import { storageKeyFactura } from '@/lib/portalFacturaRutas'

export const runtime = 'nodejs'

/** Sirve PDF/XML solo desde InsForge Storage (bucket `cfdi`). Sin hosting. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const f = String(url.searchParams.get('f') ?? '')
      .trim()
      .replace(/^\/+/, '')

    if (!/^factura\d{9}\.(pdf|xml)$/i.test(f)) {
      return NextResponse.json({ error: 'Nombre de factura inválido' }, { status: 400 })
    }

    const key = storageKeyFactura(f)
    const isPdf = f.toLowerCase().endsWith('.pdf')
    // text/xml se ve mejor al abrir en pestaña; el modal ya hace fetch→texto.
    const contentType = isPdf ? 'application/pdf' : 'text/xml; charset=utf-8'

    const client = createInsforgeAdmin()
    const { data, error } = await client.storage.from(CFDI_BUCKET).download(key)
    if (error || !data) {
      return NextResponse.json(
        {
          error:
            'Factura no encontrada en InsForge Storage. Si el pago es reciente, espere la migración o retimbre desde administración.',
          key,
        },
        { status: 404 }
      )
    }

    const bytes = new Uint8Array(await data.arrayBuffer())
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${f}"`,
        'Cache-Control': 'private, max-age=120',
        'X-Factura-Origen': 'insforge',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al servir factura'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
