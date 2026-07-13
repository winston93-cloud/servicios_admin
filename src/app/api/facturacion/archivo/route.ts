import { NextResponse } from 'next/server'
import { createInsforgeAdmin } from '@/lib/insforgeAdmin'
import { CFDI_BUCKET } from '@/lib/cfdi/cfdiStorage'
import { storageKeyFactura, urlLegacyFactura } from '@/lib/portalFacturaRutas'

export const runtime = 'nodejs'

/** Sirve PDF/XML: InsForge Storage primero, fallback hosting legacy. */
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
    const contentType = isPdf ? 'application/pdf' : 'application/xml; charset=utf-8'

    try {
      const client = createInsforgeAdmin()
      const { data, error } = await client.storage.from(CFDI_BUCKET).download(key)
      if (!error && data) {
        const bytes = new Uint8Array(await data.arrayBuffer())
        return new NextResponse(bytes, {
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `inline; filename="${f}"`,
            'Cache-Control': 'private, max-age=120',
            'X-Factura-Origen': 'insforge',
          },
        })
      }
    } catch (e) {
      console.warn('facturacion/archivo InsForge:', e instanceof Error ? e.message : e)
    }

    const legacy = urlLegacyFactura(f)
    const res = await fetch(legacy, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Factura no encontrada en Storage ni en hosting legacy' },
        { status: 404 }
      )
    }

    const buf = Buffer.from(await res.arrayBuffer())
    return new NextResponse(buf, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${f}"`,
        'Cache-Control': 'private, max-age=120',
        'X-Factura-Origen': 'legacy',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al servir factura'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
