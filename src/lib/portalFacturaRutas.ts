import {
  formatearAlumnoRefParaReferencia,
  normalizarConceptoNo,
  parsearReferenciaPago,
} from './pagoReferenciaColegiatura'
import { appBaseUrl } from './reportesConfig'

/** Base pública de facturas CFDI en hosting legacy (respaldo). */
export function baseUrlFacturasLegacy(): string {
  const base =
    process.env.NEXT_PUBLIC_FACTURAS_BASE_URL?.trim() ||
    'https://www.winston93.edu.mx/banorte/facturas'
  return base.replace(/\/$/, '')
}

/** @deprecated Usar baseUrlFacturasLegacy; el visor nuevo usa proxy InsForge. */
export function baseUrlFacturas(): string {
  return baseUrlFacturasLegacy()
}

/** Nombre sin extensión: factura{ref5}{concepto2}{ciclo2} */
export function crearNombreArchivoFactura(
  control: string | number,
  conceptoNo: string,
  cicloEscolar: number
): string | null {
  const c = formatearAlumnoRefParaReferencia(control)
  const concepto = normalizarConceptoNo(conceptoNo)
  const ciclo = String(cicloEscolar).replace(/\D/g, '').padStart(2, '0').slice(-2)
  if (!c || !concepto || !ciclo) return null
  return `factura${c}${concepto}${ciclo}`
}

/** URL absoluta vía proxy de la app → InsForge Storage (sin hosting). */
export function urlFacturaApp(nombreConExt: string): string {
  return `${appBaseUrl()}/api/facturacion/archivo?f=${encodeURIComponent(nombreConExt)}`
}

export function construirRutaFactura(
  control: string,
  conceptoNo: string,
  cicloEscolar: number
): string | null {
  const nombre = crearNombreArchivoFactura(control, conceptoNo, cicloEscolar)
  if (!nombre) return null
  return urlFacturaApp(nombre)
}

export function rutasFacturaDesdeReferencia(
  referencia: string | null | undefined,
  controlFallback: string,
  conceptoFallback: string,
  cicloFallback: number
): { pdf: string | null; xml: string | null } {
  const parsed = parsearReferenciaPago(referencia)
  const control = parsed?.alumnoRef || formatearAlumnoRefParaReferencia(controlFallback)
  const concepto =
    parsed?.conceptoNo && parsed.conceptoNo !== '00'
      ? parsed.conceptoNo
      : normalizarConceptoNo(conceptoFallback)
  const ciclo = parsed?.cicloEscolar || cicloFallback
  const nombre = crearNombreArchivoFactura(control, concepto, ciclo)
  if (!nombre) return { pdf: null, xml: null }
  return {
    pdf: urlFacturaApp(`${nombre}.pdf`),
    xml: urlFacturaApp(`${nombre}.xml`),
  }
}

export function storageKeyFactura(nombreConExt: string): string {
  return nombreConExt.replace(/^\/+/, '')
}

export function urlLegacyFactura(nombreConExt: string): string {
  return `${baseUrlFacturasLegacy()}/${nombreConExt.replace(/^\/+/, '')}`
}

/** Código de concepto para facturas Cambridge (legacy). */
export function conceptoFacturaCambridge(
  nombreConcepto: string,
  conceptoParseado?: string | null
): string {
  if (conceptoParseado && conceptoParseado.length === 2 && conceptoParseado !== '00') {
    return normalizarConceptoNo(conceptoParseado)
  }
  const n = nombreConcepto.toLowerCase()
  if (n.includes('cambridge 3')) return '22'
  if (n.includes('cambridge 2')) return '20'
  if (n.includes('cambridge 1')) return '19'
  return conceptoParseado ? normalizarConceptoNo(conceptoParseado) : '19'
}
