import { NextResponse } from 'next/server'
import { createInsforgeAdmin, createDbAdmin } from '@/lib/insforgeAdmin'
import { CFDI_BUCKET } from '@/lib/cfdi/cfdiStorage'
import { storageKeyFactura } from '@/lib/portalFacturaRutas'
import { motivoAccesoFactura, PARAM_CODIGO_FACTURA } from '@/lib/cfdi/facturaEnlaceFirmado'
import { sesionPortalDeRequest } from '@/lib/portalSesionFirmada'

export const runtime = 'nodejs'

const PAGINA_SIN_PERMISO = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Factura no disponible</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f4f6fa;color:#13233a;padding:1rem}main{max-width:420px;text-align:center;background:#fff;border:1px solid #dde3ec;border-radius:16px;padding:2rem 1.5rem}h1{font-size:1.25rem;margin:0 0 .5rem}p{color:#475569;line-height:1.5;margin:0 0 1.25rem}a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 1.25rem;border-radius:10px;background:#1e3a5f;color:#fff;text-decoration:none;font-weight:600}</style></head>
<body><main><h1>Factura no disponible</h1><p>Para ver tu factura, entra al portal de pagos con tu número de control y ábrela desde tu tabla de pagos.</p><a href="/login">Ir al portal</a></main></body></html>`

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

    const motivo = motivoAccesoFactura(f, url.searchParams.get(PARAM_CODIGO_FACTURA), sesionPortalDeRequest(request))
    if (!motivo) {
      console.warn('[factura] acceso sin código ni sesión', {
        f,
        referer: request.headers.get('referer') ?? '',
        ua: (request.headers.get('user-agent') ?? '').slice(0, 120),
      })
      return new NextResponse(PAGINA_SIN_PERMISO, {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      })
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
        'X-Factura-Acceso': motivo,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al servir factura'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
