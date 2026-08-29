import ExcelJS from 'exceljs'
import type { ResultadoConciliacion } from './satConciliacionService'
import { etiquetaEstado, fechaFacturaTexto } from './satConciliacionService'

const COLOR_HEADER = 'FF1E293B'
const COLOR_HEADER_FONT = 'FFFFFFFF'
const COLOR_OK = 'FFDCFCE7'
const COLOR_OK_FONT = 'FF166534'
const COLOR_WARN = 'FFFEF9C3'
const COLOR_ERR = 'FFFEE2E2'
const COLOR_ERR_FONT = 'FFB91C1C'
const COLOR_SUBHEADER = 'FFE2E8F0'

function estiloEncabezado(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: COLOR_HEADER_FONT }, size: 11 }
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLOR_HEADER },
  }
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  row.height = 22
}

function bordeFino(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  }
}

function hojaResumen(wb: ExcelJS.Workbook, r: ResultadoConciliacion) {
  const ws = wb.addWorksheet('Resumen', {
    views: [{ showGridLines: false }],
  })
  ws.columns = [{ width: 34 }, { width: 22 }]

  ws.mergeCells('A1:B1')
  const t = ws.getCell('A1')
  t.value = 'Conciliación CFDI recibidos · Pagos'
  t.font = { bold: true, size: 16, color: { argb: 'FF0F172A' } }

  ws.mergeCells('A2:B2')
  ws.getCell('A2').value = `Generado: ${new Date(r.meta.generado).toLocaleString('es-MX')}`
  ws.getCell('A2').font = { size: 10, color: { argb: 'FF64748B' } }

  const filas: [string, string | number][] = [
    ['Archivo CFDI', r.meta.nombreCfdi],
    ['Archivo Banorte', r.meta.nombreBanorte],
    ['Archivo Clara', r.meta.nombreClara],
    ['', ''],
    ['Facturas a conciliar (tipo I)', r.resumen.totalFacturas],
    ['Conciliadas', r.resumen.conciliadas],
    ['No localizadas', r.resumen.noLocalizadas],
    ['% conciliado', r.resumen.totalFacturas
      ? `${Math.round((r.resumen.conciliadas / r.resumen.totalFacturas) * 100)}%`
      : '0%'],
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

  let rowNum = 4
  for (const [label, val] of filas) {
    const row = ws.getRow(rowNum)
    row.getCell(1).value = label
    row.getCell(2).value = val
    row.getCell(1).font = { bold: Boolean(label), color: { argb: 'FF334155' } }
    if (typeof val === 'number' && label.toLowerCase().includes('monto')) {
      row.getCell(2).numFmt = '$#,##0.00'
    }
    rowNum += 1
  }
}

function hojaConciliacion(wb: ExcelJS.Workbook, r: ResultadoConciliacion) {
  const ws = wb.addWorksheet('Conciliación', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  const headers = [
    'Estado',
    'Confianza',
    'Fuente pago',
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

  ws.columns = [
    { width: 14 },
    { width: 10 },
    { width: 12 },
    { width: 38 },
    { width: 12 },
    { width: 14 },
    { width: 32 },
    { width: 8 },
    { width: 12 },
    { width: 14 },
    { width: 8 },
    { width: 14 },
    { width: 12 },
    { width: 14 },
    { width: 28 },
    { width: 42 },
  ]

  const headerRow = ws.addRow(headers)
  estiloEncabezado(headerRow)

  for (const f of r.filas) {
    const row = ws.addRow([
      etiquetaEstado(f.estado),
      f.confianza ? f.confianza.toUpperCase() : '',
      f.fuente,
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

    row.eachCell((cell) => {
      bordeFino(cell)
      cell.alignment = { vertical: 'top', wrapText: true }
    })

    const estadoCell = row.getCell(1)
    if (f.estado === 'conciliado') {
      estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_OK } }
      estadoCell.font = { bold: true, color: { argb: COLOR_OK_FONT } }
    } else {
      estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ERR } }
      estadoCell.font = { bold: true, color: { argb: COLOR_ERR_FONT } }
    }

    row.getCell(10).numFmt = '$#,##0.00'
    if (f.montoPagado != null) row.getCell(12).numFmt = '$#,##0.00'
    if (f.diferencia != null) row.getCell(13).numFmt = '$#,##0.00'
  }

  ws.autoFilter = { from: 'A1', to: `P${r.filas.length + 1}` }
}

function hojaNoLocalizadas(wb: ExcelJS.Workbook, r: ResultadoConciliacion) {
  const sin = r.filas.filter((f) => f.estado === 'no_localizado')
  const ws = wb.addWorksheet('No localizadas', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  const headers = ['UUID', 'Fecha', 'RFC Emisor', 'Nombre Emisor', 'Total', 'Moneda', 'Forma pago']
  ws.columns = headers.map(() => ({ width: 18 }))
  ws.getColumn(1).width = 38
  ws.getColumn(4).width = 32

  const hr = ws.addRow(headers)
  estiloEncabezado(hr)

  for (const f of sin) {
    const row = ws.addRow([
      f.factura.uuid,
      fechaFacturaTexto(f.factura),
      f.factura.emisorRfc,
      f.factura.emisorNombre,
      f.factura.total,
      f.factura.moneda,
      f.factura.formaPago,
    ])
    row.eachCell((cell) => {
      bordeFino(cell)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ERR } }
    })
    row.getCell(5).numFmt = '$#,##0.00'
  }
}

function hojaClaraSinFactura(wb: ExcelJS.Workbook, r: ResultadoConciliacion) {
  const ws = wb.addWorksheet('Clara sin factura', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  const headers = ['Fecha', 'Transacción', 'Monto MXN', 'Folio Fiscal', 'Titular', 'Categoría']
  ws.columns = [12, 28, 14, 38, 22, 20].map((w) => ({ width: w }))
  const hr = ws.addRow(headers)
  estiloEncabezado(hr)
  for (const m of r.claraSinFactura) {
    const row = ws.addRow([
      m.fecha,
      m.transaccion,
      m.montoMxn,
      m.folioFiscal,
      m.titular,
      m.categoria,
    ])
    row.getCell(3).numFmt = '$#,##0.00'
    row.eachCell(bordeFino)
  }
}

function hojaBanorteSinFactura(wb: ExcelJS.Workbook, r: ResultadoConciliacion) {
  const ws = wb.addWorksheet('Banorte sin factura', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  const headers = ['Fecha', 'Descripción', 'Retiro', 'RFC', 'Beneficiario', 'Referencia', 'Detalle']
  ws.columns = [12, 24, 14, 14, 24, 14, 40].map((w) => ({ width: w }))
  const hr = ws.addRow(headers)
  estiloEncabezado(hr)
  for (const m of r.banorteSinFactura) {
    const row = ws.addRow([
      m.fecha,
      m.descripcion,
      m.retiro,
      m.rfc,
      m.beneficiario,
      m.referencia,
      m.detalle,
    ])
    row.getCell(3).numFmt = '$#,##0.00'
    row.eachCell(bordeFino)
  }
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
