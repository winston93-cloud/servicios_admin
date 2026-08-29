import ExcelJS from 'exceljs'
import { detalleSimpleBanorte } from './detalleSimplePago'
import type { ResultadoConciliacion } from './satConciliacionService'
import { etiquetaEstado, fechaFacturaTexto } from './satConciliacionService'

/* Paleta — slate + acento cian */
const C = {
  headerBg: 'FF0F172A',
  headerFont: 'FFFFFFFF',
  headerAccent: 'FF38BDF8',
  okBg: 'FFDCFCE7',
  okSoft: 'FFF0FDF4',
  okFont: 'FF15803D',
  errBg: 'FFFEE2E2',
  errSoft: 'FFFFF1F2',
  errFont: 'FFB91C1C',
  zebra: 'FFF8FAFC',
  white: 'FFFFFFFF',
  text: 'FF334155',
  textMuted: 'FF64748B',
  borderThin: 'FF94A3B8',
  borderMed: 'FF64748B',
  borderOuter: 'FF334155',
  borderHeader: 'FF475569',
  accentSoft: 'FFE0F2FE',
  separador: 'FFF1F5F9',
} as const

/** Grilla visible en Excel y LibreOffice Calc (4 lados en cada celda). */
function aplicarGrillaCelda(
  cell: ExcelJS.Cell,
  r: number,
  c: number,
  totalRows: number,
  totalCols: number
) {
  const inner = { style: 'thin' as const, color: { argb: C.borderThin } }
  const outer = { style: 'medium' as const, color: { argb: C.borderOuter } }
  const headerLine = { style: 'medium' as const, color: { argb: C.headerAccent } }
  const headerInner = { style: 'thin' as const, color: { argb: C.borderHeader } }

  const esHeader = r === 1
  const esPrimera = r === 2
  const esUltima = r === totalRows
  const esIzq = c === 1
  const esDer = c === totalCols

  cell.border = {
    top: esHeader ? outer : esPrimera ? headerLine : inner,
    bottom: esHeader ? headerLine : esUltima ? outer : inner,
    left: esHeader ? (esIzq ? outer : headerInner) : esIzq ? outer : inner,
    right: esHeader ? (esDer ? outer : headerInner) : esDer ? outer : inner,
  }
}

type EstiloFila = 'ok' | 'err' | 'neutral' | 'separador'

type OpcionesTabla = {
  columnasMoneda?: number[]
  columnasCentradas?: number[]
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

function rellenarFila(vals: unknown[], cols: number): unknown[] {
  const out = [...vals]
  while (out.length < cols) out.push('')
  return out.slice(0, cols)
}

function estiloEncabezado(row: ExcelJS.Row, totalCols: number, totalRows: number) {
  row.height = 28
  row.font = {
    name: 'Calibri',
    bold: true,
    color: { argb: C.headerFont },
    size: 11,
  }
  for (let col = 1; col <= totalCols; col += 1) {
    const cell = row.getCell(col)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.headerBg } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    aplicarGrillaCelda(cell, 1, col, totalRows, totalCols)
  }
}

function fondoFila(
  estilo: EstiloFila | undefined,
  col: number,
  zebra: boolean
): string {
  if (estilo === 'separador') return C.separador
  if (estilo === 'err' && col === 1) return C.errBg
  if (estilo === 'err' && col <= 4) return C.errSoft
  if (estilo === 'ok' && col === 1) return C.okBg
  if (estilo === 'ok' && col <= 4) return C.okSoft
  if (estilo === 'ok' && col === 4) return C.accentSoft
  if (zebra) return C.zebra
  return C.white
}

function aplicarCeldasDatos(
  ws: ExcelJS.Worksheet,
  row: ExcelJS.Row,
  rowIndex: number,
  totalCols: number,
  totalRows: number,
  opts?: OpcionesTabla
) {
  const estilo = opts?.estiloFila?.(row, rowIndex)
  const zebra = rowIndex % 2 === 0
  const esSeparador = estilo === 'separador'

  row.height = esSeparador ? 10 : 20

  for (let col = 1; col <= totalCols; col += 1) {
    const cell = row.getCell(col)
    const bg = fondoFila(estilo, col, zebra)

    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    aplicarGrillaCelda(cell, rowIndex, col, totalRows, totalCols)

    if (esSeparador) {
      cell.value = ''
      continue
    }

    cell.font = {
      name: 'Calibri',
      size: 10,
      color: { argb: C.text },
      bold: col === 1 && (estilo === 'ok' || estilo === 'err'),
    }

    if (col === 1 && estilo === 'ok') {
      cell.font = { ...cell.font, bold: true, color: { argb: C.okFont } }
    }
    if (col === 1 && estilo === 'err') {
      cell.font = { ...cell.font, bold: true, color: { argb: C.errFont } }
    }
    if (col === 4 && estilo === 'ok') {
      cell.font = { ...cell.font, bold: true, color: { argb: 'FF0369A1' } }
    }

    cell.alignment = {
      vertical: 'middle',
      horizontal: opts?.columnasCentradas?.includes(col) ? 'center' : 'left',
      wrapText: col > 4,
    }

    if (opts?.columnasMoneda?.includes(col)) {
      cell.numFmt = '$#,##0.00'
      cell.alignment = { ...cell.alignment, horizontal: 'right' }
    }
  }
}

function crearHojaTabla(
  wb: ExcelJS.Workbook,
  nombre: string,
  headers: string[],
  anchos: number[],
  filas: unknown[][],
  opts?: OpcionesTabla
) {
  const totalCols = headers.length
  const ws = wb.addWorksheet(nombre, {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
    properties: { defaultRowHeight: 20 },
  })

  ws.columns = anchos.map((w) => ({ width: w }))

  const totalRows = filas.length + 1

  const headerRow = ws.addRow(headers)
  estiloEncabezado(headerRow, totalCols, totalRows)

  filas.forEach((vals, i) => {
    const row = ws.addRow(rellenarFila(vals, totalCols))
    aplicarCeldasDatos(ws, row, i + 2, totalCols, totalRows, opts)
  })

  if (filas.length > 0) {
    ws.autoFilter = {
      from: 'A1',
      to: `${colLetter(totalCols)}${totalRows}`,
    }
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
    [40, 30],
    metaFilas,
    {
      columnasCentradas: [2],
      estiloFila: (row) => {
        const concepto = String(row.getCell(1).value ?? '')
        if (!concepto) return 'separador'
        if (concepto === 'Conciliadas') return 'ok'
        if (concepto === 'No localizadas' && Number(row.getCell(2).value) > 0) return 'err'
        return 'neutral'
      },
    }
  )

  metaFilas.forEach((row, i) => {
    const label = String(row[0] ?? '')
    if (label.toLowerCase().includes('monto') && typeof row[1] === 'number') {
      const cell = ws.getRow(i + 2).getCell(2)
      cell.numFmt = '$#,##0.00'
      cell.alignment = { vertical: 'middle', horizontal: 'right' }
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.text } }
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

  crearHojaTabla(
    wb,
    'Conciliación',
    headers,
    [15, 11, 12, 13, 38, 13, 14, 34, 8, 12, 14, 8, 14, 12, 14, 30, 44],
    filas,
    {
      columnasMoneda: [11, 13, 14],
      columnasCentradas: [2, 3, 4, 9, 12],
      estiloFila: (row) => {
        const estado = String(row.getCell(1).value ?? '')
        if (estado === 'Conciliado') return 'ok'
        if (estado === 'No localizado') return 'err'
        return 'neutral'
      },
    }
  )
}

function hojaNoLocalizadas(wb: ExcelJS.Workbook, r: ResultadoConciliacion) {
  const sin = r.filas.filter((f) => f.estado === 'no_localizado')
  crearHojaTabla(
    wb,
    'No localizadas',
    ['Estado', 'UUID', 'Fecha', 'RFC Emisor', 'Nombre Emisor', 'Total', 'Moneda', 'Forma pago'],
    [15, 38, 13, 14, 34, 14, 8, 24],
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
      columnasCentradas: [3, 7],
      estiloFila: () => 'err',
    }
  )
}

function hojaClaraSinFactura(wb: ExcelJS.Workbook, r: ResultadoConciliacion) {
  crearHojaTabla(
    wb,
    'Clara sin factura',
    ['Detalle', 'Fecha', 'Transacción', 'Monto MXN', 'Folio Fiscal', 'Titular', 'Categoría'],
    [12, 13, 30, 14, 38, 24, 22],
    r.claraSinFactura.map((m) => [
      'Clara',
      m.fecha,
      m.transaccion,
      m.montoMxn,
      m.folioFiscal,
      m.titular,
      m.categoria,
    ]),
    {
      columnasMoneda: [4],
      columnasCentradas: [1, 2],
    }
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
    [14, 13, 26, 14, 14, 26, 14, 42],
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
    {
      columnasMoneda: [4],
      columnasCentradas: [1, 2],
    }
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
