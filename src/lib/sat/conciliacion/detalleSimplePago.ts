import type { MovimientoBanorte } from './parseBanorteTxt'
import type { MovimientoClara } from './parseClaraCsv'

/** Etiqueta corta del tipo de pago para reportes. */
export function detalleSimpleBanorte(m: MovimientoBanorte): string {
  const t = `${m.descripcion} ${m.detalle} ${m.codTransac}`.toUpperCase()

  if (t.includes('SPEI')) return 'SPEI'
  if (t.includes('TERCEROS')) return 'Terceros'
  if (t.includes('CHEQUE')) return 'Cheque'
  if (t.includes('DOMICILIA')) return 'Domiciliación'
  if (t.includes('DEPOSITO REFERENCIADO')) return 'Depósito referenciado'
  if (t.includes('CONCENTRACION')) return 'Concentración'
  if (t.includes('TRANSFERENCIA')) return 'Transferencia'
  if (t.includes('COMISION') || t.includes('IVA COMISION')) return 'Comisión'
  if (t.includes('INST WINSTON') || t.includes('DEPOSITO')) return 'Depósito'

  return 'Banorte'
}

export function detalleSimpleClara(_m?: MovimientoClara): string {
  return 'Clara'
}

export function detalleSimpleMatch(opts: {
  clara?: MovimientoClara
  banorte?: MovimientoBanorte
}): string {
  if (opts.clara && opts.banorte) {
    return `${detalleSimpleClara(opts.clara)} / ${detalleSimpleBanorte(opts.banorte)}`
  }
  if (opts.clara) return detalleSimpleClara(opts.clara)
  if (opts.banorte) return detalleSimpleBanorte(opts.banorte)
  return ''
}

export function detalleSimpleDesdeTexto(opts: {
  fuente: string
  detalle: string
  referencia?: string
}): string {
  if (opts.fuente === 'Clara') return 'Clara'
  if (!opts.fuente) return ''

  const t = `${opts.detalle} ${opts.referencia ?? ''}`.toUpperCase()
  if (t.includes('SPEI')) return 'SPEI'
  if (t.includes('TERCEROS')) return 'Terceros'
  if (t.includes('CHEQUE')) return 'Cheque'
  if (t.includes('DOMICILIA')) return 'Domiciliación'
  if (t.includes('DEPOSITO REFERENCIADO')) return 'Depósito referenciado'
  if (t.includes('CONCENTRACION')) return 'Concentración'
  if (t.includes('TRANSFERENCIA')) return 'Transferencia'
  if (t.includes('UUID EN CLARA') || t.includes('CLARA')) return 'Clara'

  return 'Banorte'
}
