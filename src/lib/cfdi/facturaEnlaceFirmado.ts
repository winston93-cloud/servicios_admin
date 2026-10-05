import { createHmac, timingSafeEqual } from 'crypto'
import type { AuthSession } from '@/lib/portalAuthService'
import { formatearAlumnoRefParaReferencia } from '@/lib/pagoReferenciaColegiatura'

/**
 * Código por factura en los enlaces `/api/facturacion/archivo?f=…&c=…`.
 * El nombre del archivo (alumno + concepto + ciclo) es predecible; el código no.
 * No caduca: el papá abre su factura igual que siempre, aunque no tenga sesión.
 * Solo servidor (usa el secreto); el navegador recibe el enlace ya firmado.
 */

const PARAM = 'c'

function secreto(): string {
  const propio = process.env.FACTURA_ENLACE_SECRET
  if (propio) return propio
  const base = process.env.INSFORGE_API_KEY
  if (!base) throw new Error('Falta INSFORGE_API_KEY para firmar enlaces de factura.')
  return createHmac('sha256', base).update('factura-enlace-v1').digest('hex')
}

/** `factura201400223.pdf` y `.xml` comparten código. */
function baseFactura(nombre: string): string | null {
  const m = /^(factura\d{9})(?:\.(?:pdf|xml))?$/i.exec(nombre.trim().replace(/^\/+/, ''))
  return m ? m[1].toLowerCase() : null
}

export function codigoFactura(nombre: string): string | null {
  const base = baseFactura(nombre)
  if (!base) return null
  return createHmac('sha256', secreto()).update(base).digest('base64url').slice(0, 32)
}

export function codigoFacturaValido(nombre: string, codigo: string | null | undefined): boolean {
  const esperado = codigoFactura(nombre)
  if (!esperado || !codigo) return false
  const a = Buffer.from(codigo)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Agrega `&c=` a un enlace del proxy de facturas; cualquier otra URL se regresa igual. */
export function firmarEnlaceFactura(url: string | null | undefined): string | null {
  if (!url) return url ?? null
  try {
    const u = new URL(url, 'http://local')
    if (!u.pathname.endsWith('/api/facturacion/archivo')) return url
    const f = u.searchParams.get('f') ?? ''
    const codigo = codigoFactura(f)
    if (!codigo) return url
    u.searchParams.set(PARAM, codigo)
    return /^https?:\/\//i.test(url) ? u.toString() : `${u.pathname}${u.search}`
  } catch {
    return url
  }
}

export function firmarRutasFactura<T extends { pdf: string | null; xml: string | null }>(rutas: T): T {
  return { ...rutas, pdf: firmarEnlaceFactura(rutas.pdf), xml: firmarEnlaceFactura(rutas.xml) }
}

export type MotivoAccesoFactura = 'codigo' | 'personal' | 'familia' | null

/** Quién puede abrir `nombre`: enlace firmado, personal con sesión o la familia del alumno. */
export function motivoAccesoFactura(
  nombre: string,
  codigo: string | null | undefined,
  sesion: AuthSession | null
): MotivoAccesoFactura {
  if (codigoFacturaValido(nombre, codigo)) return 'codigo'
  if (sesion?.role === 'usuario') return 'personal'
  const base = baseFactura(nombre)
  if (sesion?.role === 'alumno' && sesion.alumno_ref && base) {
    if (base.slice(7, 12) === formatearAlumnoRefParaReferencia(sesion.alumno_ref)) return 'familia'
  }
  return null
}

export const PARAM_CODIGO_FACTURA = PARAM
