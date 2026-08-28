export type CfdiRecibidoFila = {
  uuid: string
  fecha: string
  serie: string
  folio: string
  tipoComprobante: string
  emisorRfc: string
  emisorNombre: string
  receptorRfc: string
  receptorNombre: string
  subtotal: number
  descuento: number
  total: number
  moneda: string
}

function attr(xml: string, tag: string, name: string): string {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${tag}\\b[^>]*\\b${name}=["']([^"']*)["']`,
    'i'
  )
  const m = xml.match(re)
  return m?.[1]?.trim() ?? ''
}

function num(val: string): number {
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}

/** Extrae campos mínimos de un XML CFDI 3.3 / 4.0. */
export function parsearCfdiXml(xml: string): CfdiRecibidoFila | null {
  const src = xml.trim()
  if (!src.includes('Comprobante') && !src.includes('comprobante')) return null

  const uuid =
    attr(src, 'TimbreFiscalDigital', 'UUID') ||
    attr(src, 'timbreFiscalDigital', 'UUID')

  return {
    uuid: uuid.toUpperCase(),
    fecha: attr(src, 'Comprobante', 'Fecha'),
    serie: attr(src, 'Comprobante', 'Serie'),
    folio: attr(src, 'Comprobante', 'Folio'),
    tipoComprobante: attr(src, 'Comprobante', 'TipoDeComprobante'),
    emisorRfc: attr(src, 'Emisor', 'Rfc'),
    emisorNombre: attr(src, 'Emisor', 'Nombre'),
    receptorRfc: attr(src, 'Receptor', 'Rfc'),
    receptorNombre: attr(src, 'Receptor', 'Nombre'),
    subtotal: num(attr(src, 'Comprobante', 'SubTotal')),
    descuento: num(attr(src, 'Comprobante', 'Descuento')),
    total: num(attr(src, 'Comprobante', 'Total')),
    moneda: attr(src, 'Comprobante', 'Moneda') || 'MXN',
  }
}
