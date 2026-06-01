import {
  formatearAlumnoRefParaReferencia,
  normalizarConceptoNo,
  parsearReferenciaPago,
} from './pagoReferenciaColegiatura'

/** Base pública de facturas CFDI (legacy Banorte). */
export function baseUrlFacturas(): string {
  const base =
    process.env.NEXT_PUBLIC_FACTURAS_BASE_URL?.trim() ||
    'https://www.winston93.edu.mx/banorte/facturas'
  return base.replace(/\/$/, '')
}

export function construirRutaFactura(
  control: string,
  conceptoNo: string,
  cicloEscolar: number
): string | null {
  const c = formatearAlumnoRefParaReferencia(control)
  const concepto = normalizarConceptoNo(conceptoNo)
  const ciclo = String(cicloEscolar).replace(/\D/g, '').padStart(2, '0').slice(-2)
  if (!c || !concepto || !ciclo) return null
  return `${baseUrlFacturas()}/factura${c}${concepto}${ciclo}`
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
  const base = construirRutaFactura(control, concepto, ciclo)
  if (!base) return { pdf: null, xml: null }
  return { pdf: `${base}.pdf`, xml: `${base}.xml` }
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
