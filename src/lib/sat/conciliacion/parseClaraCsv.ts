import { normalizarUuid, parseCsv, parseFechaIso, parseMoneyMx } from './conciliacionUtils'

export type MovimientoClara = {
  id: string
  fecha: string
  transaccion: string
  montoMxn: number
  monedaOriginal: string
  montoOriginal: number
  tarjeta: string
  titular: string
  folioFiscal: string
  uuid: string
  categoria: string
  ubicacion: string
  facturaElectronica: boolean
}

export function leerClaraCsv(buffer: Buffer): MovimientoClara[] {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '')
  const rows = parseCsv(text)
  if (!rows.length) throw new Error('El CSV de Clara está vacío.')

  const movimientos: MovimientoClara[] = []
  rows.forEach((row, i) => {
    const folio = row['Folio Fiscal'] ?? ''
    const montoMxn = parseMoneyMx(row['Monto en MXN'])
    if (montoMxn <= 0) return
    movimientos.push({
      id: `cla-${i + 1}`,
      fecha: row['Fecha de Transacción'] ?? '',
      transaccion: row['Transacción'] ?? '',
      montoMxn,
      monedaOriginal: row['Moneda original'] ?? 'MXN',
      montoOriginal: parseMoneyMx(row['Monto original']),
      tarjeta: row['Tarjeta'] ?? '',
      titular: row['Titular'] ?? '',
      folioFiscal: folio,
      uuid: normalizarUuid(folio),
      categoria: row['Categoría de Compra'] ?? '',
      ubicacion: row['Ubicación'] ?? '',
      facturaElectronica: (row['Factura Electrónica'] ?? '').toLowerCase() === 'sí' ||
        (row['Factura Electrónica'] ?? '').toLowerCase() === 'si' ||
        (row['Factura Electrónica'] ?? '').toLowerCase() === 'true',
    })
  })

  if (!movimientos.length) {
    throw new Error('No se encontraron transacciones en el CSV de Clara.')
  }
  return movimientos
}

export function fechaMovimientoClara(m: MovimientoClara): Date | null {
  return parseFechaIso(m.fecha)
}
