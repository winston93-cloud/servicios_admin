import ExcelJS from 'exceljs'
import { detalleSimpleBanorte } from './detalleSimplePago'
import type { ResultadoConciliacion } from './satConciliacionService'
import { etiquetaEstado, fechaFacturaTexto } from './satConciliacionService'

const COLOR_HEADER = 'FF1E293B'
const COLOR_HEADER_FONT = 'FFFFFFFF'
const COLOR_OK = 'FFDCFCE7'
const COLOR_OK_FONT = 'FF166534'
const COLOR_ERR = 'FFFEE2E2'
const COLOR_ERR_FONT = 'FFB91C1C'
const COLOR_ZEBRA = 'FFF8FAFC'
const COLOR_BORDER = 'FFE2E8F0'

type EstiloFila = 'ok' | 'err' | 'neutral'

type OpcionesTabla = {
  columnasMoneda?: number[]
  estiloFila?: (row: ExcelJS.Row, rowIndex: number) => EstiloFila | undefined
}

function colLetter(n: number): string {
  let s = ''
  let num = n
  while (num > 0) {
    const mod = (num - 1) % 26
    s = String.fromCharCode(65 + mod) + s
    num = Math.floor((num - 1) / 26)
  }
  return s
}

function estiloEncabezado(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: COLOR_HEADER_FONT }, size: 11 }
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLOR_HEADER },
  }
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  row.height = 24
}

function bordeFino(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: COLOR_BORDER } },
    left: { style: 'thin', color: { argb: COLOR_BORDER } },
    bottom: { style: 'thin', color: { argb: COLOR_BORDER } },
    right: { style: 'thin', color: { argb: COLOR_BORDER } },
  }
}

function aplicarCeldasDatos(
  row: ExcelJS.Row,
  rowIndex: number,
  opts?: OpcionesTabla
) {
  const estilo = opts?.estiloFila?.(row, rowIndex)
  const zebra = rowIndex % 2 === 0

  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    bordeFino(cell)
    cell.alignment = { vertical: 'top', wrapText: true }

    if (estilo === 'ok' && colNumber === 1) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_OK } }
      cell.font = { bold: true, color: { argb: COLOR_OK_FONT } }
    } else if (estilo === 'err' && colNumber === 1) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ERR } }
      cell.font = { bold: true, color: { argb: COLOR_ERR_FONT } }
    } else if (estilo === 'err') {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ERR } }
    } else if (zebra) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ZEBRA } }
    }

    if (opts?.columnasMoneda?.includes(colNumber)) {
      cell.numFmt = '$#,##0.00'
    }
  })
}

function crearHojaTabla(
  wb: ExcelJS.Workbook,
  nombre: string,
  headers: string[],
  anchos: number[],
  filas: unknown[][],
  opts?: OpcionesTabla
) {
  const ws = wb.addWorksheet(nombre, {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
  })

  ws.columns = anchos.map((w) => ({ width: w }))
  const headerRow = ws.addRow(headers)
  estiloEncabezado(headerRow)

  filas.forEach((vals, i) => {
    const row = ws.addRow(vals)
    aplicarCeldasDatos(row, i + 2, opts)
  })

  const lastCol = colLetter(headers.length)
  const lastRow = filas.length + 1
  if (filas.length > 0) {
    ws.autoFilter = { from: 'A1', to: `${lastCol}${lastRow}` }
  }

  return ws
}

function hojaResumen(wb: ExcelJS.Workbook, r: ResultadoConciliacion) {
  const metaFilas: unknown[][] = [
    ['Archivo CFDI', r.meta.nombreCfdi],
    ['Archivo Banorte', r.meta.nombreBanorte],
    ['Archivo Clara', r.meta.nombreClara],
    ['Generado', new Date(r.meta.generado).toLocaleString('es-MX')],
    ['', ''],
    ['Facturas a conciliar (tipo I)', r.resumen.totalFacturas],
    ['Conciliadas', r.resumen.conciliadas],
    ['No localizadas', r.resumen.noLocalizadas],
    [
      '% conciliado',
      r.resumen.totalFacturas
        ? `${Math.round((r.resumen.conciliadas / r.resumen.totalFacturas) * 100)}%`
        : '0%',
    ],
    ['', ''],
    ['Monto total facturas', r.resumen.montoFacturas],
    ['Monto conciliado', r.resumen.montoConciliado],
    ['', ''],
    ['Pagos Clara', r.resumen.porFuente.clara],
    ['Pagos Banorte', r.resumen.porFuente.banorte],
    ['Confianza alta', r.resumen.porConfianza.alta],
    ['Confianza media', r.resumen.porConfianza.media],
    ['Mov. Clara sin factura', r.claraSinFactura.length],
    ['Mov. Banorte sin factura', r.banorteSinFactura.length],
  ]

  const ws = crearHojaTabla(
    wb,
    'Resumen',
    ['Concepto', 'Valor'],
    [38, 28],
    metaFilas,
    {
      estiloFila: (row) => {
        const concepto = String(row.getCell(1).value ?? '')
        if (concepto === 'Conciliadas') return 'ok'
        if (concepto === 'No localizadas' && Number(row.getCell(2).value) > 0) return 'err'
        return 'neutral'
      },
    }
  )

  metaFilas.forEach((row, i) => {
    const label = String(row[0] ?? '')
    if (label.toLowerCase().includes('monto') && typeof row[1] === 'number') {
      ws.getRow(i + 2).getCell(2).numFmt = '$#,##0.00'
    }
  })
}

function hojaConciliacion(wb: ExcelJS.Workbook, r: ResultadoConciliacion) {
  const headers = [
    'Estado',
    'Confianza',
    'Fuente pago',
    'Detalle',
    'UUID',
    'Fecha factura',
    'RFC Emisor',
    'Nombre Emisor',
    'Serie',
    'Folio',
    'Total factura',
    'Moneda',
    'Monto pagado',
    'Diferencia',
    'Fecha pago',
    'Referencia / movimiento',
    'Detalle conciliación',
  ]

  const filas = r.filas.map((f) => [
    etiquetaEstado(f.estado),
    f.confianza ? f.confianza.toUpperCase() : '',
    f.fuente,
    f.detalleSimple,
    f.factura.uuid,
    fechaFacturaTexto(f.factura),
    f.factura.emisorRfc,
    f.factura.emisorNombre,
    f.factura.serie,
    f.factura.folio,
    f.factura.total,
    f.factura.moneda,
    f.montoPagado,
    f.diferencia,
    f.fechaPago,
    f.referencia,
    f.detalle,
  ])

  crearHojaTabla(wb, 'Conciliación', headers, [
    14, 10, 12, 14, 38, 12, 14, 32, 8, 12, 14, 8, 14, 12, 14, 28, 42,
  ], filas, {
    columnasMoneda: [11, 13, 14],
    estiloFila: (row) => {
      const estado = String(row.getCell(1).value ?? '')
      if (estado === 'Conciliado') return 'ok'
      if (estado === 'No localizado') return 'err'
      return 'neutral'
    },
  })
}

function hojaNoLocalizadas(wb: ExcelJS.Workbook, r: ResultadoConciliacion) {
  const sin = r.filas.filter((f) => f.estado === 'no_localizado')
  crearHojaTabla(
    wb,
    'No localizadas',
    ['Estado', 'UUID', 'Fecha', 'RFC Emisor', 'Nombre Emisor', 'Total', 'Moneda', 'Forma pago'],
    [14, 38, 12, 14, 32, 14, 8, 22],
    sin.map((f) => [
      'No localizado',
      f.factura.uuid,
      fechaFacturaTexto(f.factura),
      f.factura.emisorRfc,
      f.factura.emisorNombre,
      f.factura.total,
      f.factura.moneda,
      f.factura.formaPago,
    ]),
    {
      columnasMoneda: [6],
      estiloFila: () => 'err',
    }
  )
}

function hojaClaraSinFactura(wb: ExcelJS.Workbook, r: ResultadoConciliacion) {
  crearHojaTabla(
    wb,
    'Clara sin factura',
    ['Detalle', 'Fecha', 'Transacción', 'Monto MXN', 'Folio Fiscal', 'Titular', 'Categoría'],
    [12, 12, 28, 14, 38, 22, 20],
    r.claraSinFactura.map((m) => [
      'Clara',
      m.fecha,
      m.transaccion,
      m.montoMxn,
      m.folioFiscal,
      m.titular,
      m.categoria,
    ]),
    { columnasMoneda: [4] }
  )
}

function hojaBanorteSinFactura(wb: ExcelJS.Workbook, r: ResultadoConciliacion) {
  crearHojaTabla(
    wb,
    'Banorte sin factura',
    [
      'Detalle',
      'Fecha',
      'Descripción',
      'Retiro',
      'RFC',
      'Beneficiario',
      'Referencia',
      'Descripción detallada',
    ],
    [14, 12, 24, 14, 14, 24, 14, 40],
    r.banorteSinFactura.map((m) => [
      detalleSimpleBanorte(m),
      m.fecha,
      m.descripcion,
      m.retiro,
      m.rfc,
      m.beneficiario,
      m.referencia,
      m.detalle,
    ]),
    { columnasMoneda: [4] }
  )
}

export async function generarExcelConciliacion(
  resultado: ResultadoConciliacion
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'servicios_admin · Módulo SAT'
  wb.created = new Date()

  hojaResumen(wb, resultado)
  hojaConciliacion(wb, resultado)
  hojaNoLocalizadas(wb, resultado)
  hojaClaraSinFactura(wb, resultado)
  hojaBanorteSinFactura(wb, resultado)

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
