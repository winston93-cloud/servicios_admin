import ExcelJS from 'exceljs'
import { parseMoneyMx } from './conciliacionUtils'

export type CfdiExcelFila = {
  uuid: string
  fecha: string
  serie: string
  folio: string
  tipo: string
  metodoPago: string
  formaPago: string
  emisorRfc: string
  emisorNombre: string
  receptorRfc: string
  receptorNombre: string
  subtotal: number
  descuento: number
  total: number
  moneda: string
}

const COLUMNAS = {
  uuid: ['UUID'],
  fecha: ['Fecha'],
  serie: ['Serie'],
  folio: ['Folio'],
  tipo: ['Tipo'],
  metodoPago: ['Método pago', 'Metodo pago'],
  formaPago: ['Forma pago'],
  emisorRfc: ['RFC Emisor'],
  emisorNombre: ['Nombre Emisor'],
  receptorRfc: ['RFC Receptor'],
  receptorNombre: ['Nombre Receptor'],
  subtotal: ['SubTotal', 'Subtotal'],
  descuento: ['Descuento'],
  total: ['Total'],
  moneda: ['Moneda'],
} as const

function celdaTexto(v: ExcelJS.CellValue): string {
  if (v == null) return ''
  if (typeof v === 'object' && 'text' in v) return String(v.text ?? '')
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

function indiceColumnas(headerRow: ExcelJS.Row): Map<keyof CfdiExcelFila, number> {
  const map = new Map<keyof CfdiExcelFila, number>()
  headerRow.eachCell((cell, col) => {
    const texto = celdaTexto(cell.value).trim()
    for (const [key, aliases] of Object.entries(COLUMNAS) as [
      keyof CfdiExcelFila,
      readonly string[],
    ][]) {
      if (aliases.some((a) => a.toLowerCase() === texto.toLowerCase())) {
        map.set(key, col)
      }
    }
  })
  return map
}

function aArrayBuffer(input: Buffer | Uint8Array | ArrayBuffer): ArrayBuffer {
  if (input instanceof ArrayBuffer) return input
  const bytes = Buffer.isBuffer(input) ? new Uint8Array(input) : input
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

export async function leerCfdiRecibidosExcel(
  input: Buffer | Uint8Array | ArrayBuffer
): Promise<CfdiExcelFila[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(aArrayBuffer(input))
  const ws =
    wb.getWorksheet('CFDI Recibidos') ??
    wb.worksheets.find((w) => w.rowCount > 1) ??
    wb.worksheets[0]
  if (!ws) throw new Error('El Excel no contiene hojas legibles.')

  const headerRow = ws.getRow(1)
  const cols = indiceColumnas(headerRow)
  if (!cols.has('uuid') || !cols.has('total')) {
    throw new Error(
      'El Excel no tiene el formato de CFDI recibidos (columnas UUID y Total requeridas).'
    )
  }

  const filas: CfdiExcelFila[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const get = (key: keyof CfdiExcelFila) => {
      const col = cols.get(key)
      return col ? celdaTexto(row.getCell(col).value).trim() : ''
    }
    const uuid = get('uuid')
    if (!uuid) return
    filas.push({
      uuid,
      fecha: get('fecha'),
      serie: get('serie'),
      folio: get('folio'),
      tipo: get('tipo'),
      metodoPago: get('metodoPago'),
      formaPago: get('formaPago'),
      emisorRfc: get('emisorRfc'),
      emisorNombre: get('emisorNombre'),
      receptorRfc: get('receptorRfc'),
      receptorNombre: get('receptorNombre'),
      subtotal: parseMoneyMx(get('subtotal')),
      descuento: parseMoneyMx(get('descuento')),
      total: parseMoneyMx(get('total')),
      moneda: get('moneda') || 'MXN',
    })
  })

  if (!filas.length) {
    throw new Error('No se encontraron CFDI en el Excel.')
  }
  return filas
}

export function filtrarFacturasConciliacion(filas: CfdiExcelFila[]): CfdiExcelFila[] {
  return filas.filter((f) => f.tipo.toUpperCase() === 'I' && f.total > 0)
}
