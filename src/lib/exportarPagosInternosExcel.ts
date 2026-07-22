import ExcelJS from 'exceljs'
import type { PagoInternoListadoFila } from '@/lib/pagoInternoService'
import { PAGO_INTERNO_FOLIO_INICIAL } from '@/lib/pagoInternoService'

export type FilaExportPagoInterno = {
  folio: number
  fecha: string
  alumnoRef: string
  alumno: string
  concepto: string
  ciclo: string
  importe: number
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

export async function exportarPagosInternosExcel(opts: {
  filas: FilaExportPagoInterno[]
  folioDesde?: number
}): Promise<void> {
  const folioDesde = opts.folioDesde ?? PAGO_INTERNO_FOLIO_INICIAL
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Servicios Administrativos'
  workbook.created = new Date()

  const ws = workbook.addWorksheet('Pagos internos', {
    views: [{ state: 'frozen', ySplit: 4 }],
  })

  ws.columns = [
    { key: 'folio', width: 12 },
    { key: 'fecha', width: 12 },
    { key: 'alumnoRef', width: 14 },
    { key: 'alumno', width: 38 },
    { key: 'concepto', width: 42 },
    { key: 'ciclo', width: 14 },
    { key: 'importe', width: 14 },
  ]

  const titulo = ws.addRow(['Listado de pagos internos'])
  ws.mergeCells(1, 1, 1, 7)
  titulo.getCell(1).font = { bold: true, size: 16, color: { argb: 'FF065F46' } }
  titulo.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
  titulo.height = 26

  const hoy = new Date()
  const fechaGen = hoy.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const sub = ws.addRow([
    `Folios desde ${folioDesde} · ${opts.filas.length} registro${opts.filas.length === 1 ? '' : 's'} · Generado el ${fechaGen}`,
  ])
  ws.mergeCells(2, 1, 2, 7)
  sub.getCell(1).font = { size: 10, color: { argb: 'FF64748B' } }
  sub.height = 18

  ws.addRow([])

  const header = ws.addRow([
    'Folio',
    'Fecha',
    'No. control',
    'Alumno',
    'Concepto',
    'Ciclo',
    'Importe',
  ])
  header.height = 22
  header.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' },
    }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF047857' } },
      left: { style: 'thin', color: { argb: 'FF047857' } },
      bottom: { style: 'thin', color: { argb: 'FF047857' } },
      right: { style: 'thin', color: { argb: 'FF047857' } },
    }
  })

  const zebra = 'FFF0FDF4'
  const blanco = 'FFFFFFFF'
  const borde = { style: 'thin' as const, color: { argb: 'FFD1D5DB' } }

  for (let i = 0; i < opts.filas.length; i++) {
    const f = opts.filas[i]
    const row = ws.addRow([
      f.folio,
      f.fecha,
      f.alumnoRef,
      f.alumno,
      f.concepto,
      f.ciclo,
      f.importe,
    ])
    const bg = i % 2 === 0 ? blanco : zebra
    row.eachCell((cell, col) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.border = { top: borde, left: borde, bottom: borde, right: borde }
      cell.font = { size: 10, color: { argb: 'FF0F172A' } }
      cell.alignment = {
        vertical: 'middle',
        horizontal: col === 7 ? 'right' : col === 1 || col === 2 || col === 6 ? 'center' : 'left',
        wrapText: col === 4 || col === 5,
      }
    })
    row.getCell(7).numFmt = '"$"#,##0.00'
  }

  const totalImporte = opts.filas.reduce((acc, f) => acc + (Number(f.importe) || 0), 0)
  const totalRow = ws.addRow(['', '', '', '', '', 'Total', totalImporte])
  totalRow.height = 22
  totalRow.eachCell((cell, col) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFECFDF5' },
    }
    cell.font = {
      bold: true,
      size: 11,
      color: { argb: 'FF065F46' },
    }
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF059669' } },
      left: borde,
      bottom: borde,
      right: borde,
    }
    cell.alignment = {
      vertical: 'middle',
      horizontal: col === 7 ? 'right' : col === 6 ? 'right' : 'left',
    }
  })
  totalRow.getCell(7).numFmt = '"$"#,##0.00'

  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4 + opts.filas.length, column: 7 },
  }

  const stamp = hoy.toISOString().slice(0, 10).replace(/-/g, '')
  const buffer = await workbook.xlsx.writeBuffer()
  descargarBuffer(buffer, `pagos_internos_${stamp}.xlsx`)
}

/** Helpers compartidos con el modal (evita duplicar formateo en export). */
export function mapFilasParaExcel(
  filas: PagoInternoListadoFila[],
  map: {
    nombre: (p: PagoInternoListadoFila) => string
    concepto: (p: PagoInternoListadoFila) => string
    fecha: (iso: string | null) => string
    ciclo: (p: PagoInternoListadoFila) => string
    ref: (p: PagoInternoListadoFila) => string
  }
): FilaExportPagoInterno[] {
  return filas.map((p) => ({
    folio: p.pago_folio,
    fecha: map.fecha(p.pago_fecha),
    alumnoRef: map.ref(p),
    alumno: map.nombre(p),
    concepto: map.concepto(p),
    ciclo: map.ciclo(p),
    importe: Number(p.pago_importe) || 0,
  }))
}
