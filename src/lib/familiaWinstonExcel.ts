/**
 * 2026-10-06 — Familia Winston: exportar a Excel las listas del seguimiento (pendientes y
 * aplicados) tal como se ven filtradas en el módulo. Se carga bajo demanda en el navegador.
 */
import ExcelJS from 'exceljs'

export interface ColumnaExcelFamiliaWinston {
  titulo: string
  ancho: number
}

function descargarBuffer(buffer: ArrayBuffer | ExcelJS.Buffer, nombre: string) {
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  window.URL.revokeObjectURL(url)
}

function bordeFino(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFCBD5E1' } }
  return { top: side, left: side, bottom: side, right: side }
}

export async function exportarFamiliaWinstonExcel(opts: {
  hoja: string
  titulo: string
  subtitulo: string
  columnas: ColumnaExcelFamiliaWinston[]
  filas: (string | number | null)[][]
  archivo: string
}) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Servicios Administrativos'
  workbook.created = new Date()
  const ws = workbook.addWorksheet(opts.hoja.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  ws.columns = opts.columnas.map((c) => ({ width: c.ancho }))
  const ultima = opts.columnas.length

  ws.mergeCells(1, 1, 1, ultima)
  const titulo = ws.getCell(1, 1)
  titulo.value = opts.titulo
  titulo.font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } }
  ws.mergeCells(2, 1, 2, ultima)
  const sub = ws.getCell(2, 1)
  sub.value = opts.subtitulo
  sub.font = { size: 10, color: { argb: 'FF64748B' } }

  const cabeza = ws.getRow(3)
  opts.columnas.forEach((c, i) => {
    const cell = cabeza.getCell(i + 1)
    cell.value = c.titulo
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = bordeFino()
  })
  cabeza.height = 22

  for (const fila of opts.filas) {
    const row = ws.addRow(fila.map((v) => v ?? ''))
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = bordeFino()
    })
  }
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: ultima } }

  descargarBuffer(await workbook.xlsx.writeBuffer(), opts.archivo)
}
