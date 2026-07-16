import { NextResponse } from 'next/server'
import { createInsforgeAdmin, createDbAdmin } from '@/lib/insforgeAdmin'
import { CFDI_BUCKET } from '@/lib/cfdi/cfdiStorage'
import { storageKeyFactura } from '@/lib/portalFacturaRutas'

export const runtime = 'nodejs'

async function descargarClave(key: string) {
  const client = createInsforgeAdmin()
  return client.storage.from(CFDI_BUCKET).download(key)
}

/** Si el canónico no existe, busca la ruta real en cfdi_timbrado (p. ej. variantes). */
async function claveAlternaDesdeTimbrado(f: string): Promise<string | null> {
  const base = f.replace(/\.(pdf|xml)$/i, '')
  const esPdf = /\.pdf$/i.test(f)
  const col = esPdf ? 'pdf_storage_path' : 'xml_storage_path'
  const db = createDbAdmin()
  const { data, error } = await db
    .from('cfdi_timbrado')
    .select('pdf_storage_path,xml_storage_path')
    .eq('estado', 'timbrado')
    .or(`${col}.eq.${f},${col}.ilike.${base}%`)
    .order('timbrado_id', { ascending: false })
    .limit(5)
  if (error || !data?.length) return null
  for (const row of data) {
    const path = esPdf ? row.pdf_storage_path : row.xml_storage_path
    if (typeof path === 'string' && path.length > 0) return path
  }
  return null
}

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
    const contentType = isPdf ? 'application/pdf' : 'text/xml; charset=utf-8'

    let { data, error } = await descargarClave(key)
    if (error || !data) {
      const alt = await claveAlternaDesdeTimbrado(f)
      if (alt && alt !== key) {
        ;({ data, error } = await descargarClave(alt))
      }
    }

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
