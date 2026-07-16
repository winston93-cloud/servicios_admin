import type { AppInsforgeClient } from '@/lib/dbTypes'
import { crearNombreArchivoFactura } from '@/lib/portalFacturaRutas'

export const CFDI_BUCKET = 'cfdi'

export type CfdiArchivosGuardados = {
  xmlKey: string | null
  pdfKey: string | null
  xmlUrl: string | null
  pdfUrl: string | null
}

function claveFactura(baseNombre: string, ext: 'xml' | 'pdf'): string {
  return `${baseNombre}.${ext}`
}

/**
 * Persiste XML/PDF del PAC en InsForge Storage (bucket `cfdi`).
 * Naming legacy: factura{ref5}{concepto}{ciclo}.{xml|pdf}
 */
export async function guardarArchivosCfdi(
  client: AppInsforgeClient,
  opts: {
    alumnoRef: string | number
    conceptoNo: string
    ciclo: number
    xml?: string | null
    pdfBase64?: string | null
  }
): Promise<CfdiArchivosGuardados> {
  const base = crearNombreArchivoFactura(opts.alumnoRef, opts.conceptoNo, opts.ciclo)
  const vacio: CfdiArchivosGuardados = {
    xmlKey: null,
    pdfKey: null,
    xmlUrl: null,
    pdfUrl: null,
  }
  if (!base) return vacio

  let xmlKey: string | null = null
  let pdfKey: string | null = null
  let xmlUrl: string | null = null
  let pdfUrl: string | null = null

  if (opts.xml?.trim()) {
    const key = claveFactura(base, 'xml')
    const blob = new Blob([opts.xml], { type: 'application/xml; charset=utf-8' })
    try {
      await client.storage.from(CFDI_BUCKET).remove(key)
    } catch {
      /* no existía */
    }
    const { data, error } = await client.storage.from(CFDI_BUCKET).upload(key, blob)
    if (error) {
      console.error('cfdiStorage XML:', error.message)
    } else {
      xmlKey = data?.key ?? key
      xmlUrl = data?.url ?? null
    }
  }

  if (opts.pdfBase64?.trim()) {
    const key = claveFactura(base, 'pdf')
    try {
      const bin = Buffer.from(opts.pdfBase64.replace(/\s/g, ''), 'base64')
      const blob = new Blob([bin], { type: 'application/pdf' })
      try {
        await client.storage.from(CFDI_BUCKET).remove(key)
      } catch {
        /* no existía */
      }
      const { data, error } = await client.storage.from(CFDI_BUCKET).upload(key, blob)
      if (error) {
        console.error('cfdiStorage PDF:', error.message)
      } else {
        pdfKey = data?.key ?? key
        pdfUrl = data?.url ?? null
      }
    } catch (e) {
      console.error('cfdiStorage PDF decode:', e instanceof Error ? e.message : e)
    }
  }

  return { xmlKey, pdfKey, xmlUrl, pdfUrl }
}

export function urlPublicaObjetoCfdi(key: string | null | undefined): string | null {
  if (!key) return null
  const base = (
    process.env.NEXT_PUBLIC_INSFORGE_URL ??
    process.env.INSFORGE_URL ??
    ''
  ).replace(/\/$/, '')
  if (!base) return null
  return `${base}/api/storage/buckets/${CFDI_BUCKET}/objects/${encodeURIComponent(key)}`
}
