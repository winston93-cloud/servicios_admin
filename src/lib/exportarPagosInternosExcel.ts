import ExcelJS from 'exceljs'
import type { PagoInternoListadoFila } from '@/lib/pagoInternoService'
import {
  folioInicialPlantel,
  type PlantelPagosInternos,
} from '@/lib/pagoInternoPlantel'

export type FilaExportPagoInterno = {
  folio: number
  fecha: string
  alumnoRef: string
  alumno: string
  concepto: string
  ciclo: string
  importe: number
}

export type HojaExportPagoInterno = {
  plantel: PlantelPagosInternos
  nombreHoja: string
  filas: FilaExportPagoInterno[]
}

/** Anchos en unidades Excel (~caracteres). Suficientes para no empalmar en Calc/Excel. */
const ANCHOS = {
  folio: 11,
  fecha: 13,
  alumnoRef: 14,
  alumno: 36,
  concepto: 48,
  ciclo: 13,
  importe: 12,
} as const

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

function lineasEstimadas(texto: string, anchoCol: number): number {
  const t = String(texto ?? '').trim()
  if (!t) return 1
  const charsPorLinea = Math.max(10, Math.floor(anchoCol * 0.95))
  return t.split(/\r?\n/).reduce((acc, linea) => {
    return acc + Math.max(1, Math.ceil(linea.length / charsPorLinea))
  }, 0)
}

function alturaFila(...pares: Array<[string, number]>): number {
  const lineas = Math.max(1, ...pares.map(([t, w]) => lineasEstimadas(t, w)))
  return Math.min(90, Math.max(20, 6 + lineas * 14))
}

function estiloBordeFino(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFCBD5E1' } }
  return { top: side, left: side, bottom: side, right: side }
}

function escribirHoja(
  workbook: ExcelJS.Workbook,
  hoja: HojaExportPagoInterno,
  fechaGen: string
) {
  const folioDesde = folioInicialPlantel(hoja.plantel)
  const ws = workbook.addWorksheet(hoja.nombreHoja.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    properties: { defaultRowHeight: 20 },
  })

  ws.columns = [
    { key: 'folio', width: ANCHOS.folio },
    { key: 'fecha', width: ANCHOS.fecha },
    { key: 'alumnoRef', width: ANCHOS.alumnoRef },
    { key: 'alumno', width: ANCHOS.alumno },
    { key: 'concepto', width: ANCHOS.concepto },
    { key: 'ciclo', width: ANCHOS.ciclo },
    { key: 'importe', width: ANCHOS.importe },
  ]

  const titulo = ws.addRow([`Listado de pagos internos — ${hoja.nombreHoja}`])
  ws.mergeCells(1, 1, 1, 7)
  titulo.getCell(1).font = { bold: true, size: 16, color: { argb: 'FF065F46' } }
  titulo.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', wrapText: false }
  titulo.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFECFDF5' },
  }
  titulo.height = 28

  const sub = ws.addRow([
    `Serie desde folio ${folioDesde} · ${hoja.filas.length} registro${hoja.filas.length === 1 ? '' : 's'} · Generado el ${fechaGen}`,
  ])
  ws.mergeCells(2, 1, 2, 7)
  sub.getCell(1).font = { size: 10, color: { argb: 'FF475569' } }
  sub.getCell(1).alignment = { vertical: 'middle', wrapText: true }
  sub.height = 20

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
  header.height = 24
  header.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' },
    }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF047857' } },
      left: { style: 'thin', color: { argb: 'FF047857' } },
      bottom: { style: 'thin', color: { argb: 'FF047857' } },
      right: { style: 'thin', color: { argb: 'FF047857' } },
    }
  })

  const zebra = 'FFF0FDF4'
  const blanco = 'FFFFFFFF'
  const borde = estiloBordeFino()

  for (let i = 0; i < hoja.filas.length; i++) {
    const f = hoja.filas[i]
    const alumno = (f.alumno || '—').trim() || '—'
    const concepto = (f.concepto || '—').trim() || '—'
    const ciclo = (f.ciclo || '—').trim() || '—'
    const ref = (f.alumnoRef || '—').trim() || '—'
    const fecha = (f.fecha || '—').trim() || '—'

    const row = ws.addRow([f.folio, fecha, ref, alumno, concepto, ciclo, f.importe])
    const bg = i % 2 === 0 ? blanco : zebra

    for (let col = 1; col <= 7; col++) {
      const cell = row.getCell(col)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.border = borde
      cell.font = { size: 10, color: { argb: 'FF0F172A' } }
      cell.alignment = {
        vertical: 'middle',
        horizontal: col === 7 ? 'right' : col === 1 || col === 2 || col === 6 ? 'center' : 'left',
        wrapText: true,
        shrinkToFit: false,
      }
    }

    row.getCell(7).numFmt = '"$"#,##0.00'
    row.height = alturaFila([alumno, ANCHOS.alumno], [concepto, ANCHOS.concepto])
  }

  const totalImporte = hoja.filas.reduce((acc, f) => acc + (Number(f.importe) || 0), 0)
  const totalRow = ws.addRow(['', '', '', '', '', 'Total', totalImporte])
  totalRow.height = 24
  for (let col = 1; col <= 7; col++) {
    const cell = totalRow.getCell(col)
    if (col < 6 && (cell.value == null || cell.value === '')) {
      cell.value = ''
    }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFECFDF5' },
    }
    cell.font = { bold: true, size: 11, color: { argb: 'FF065F46' } }
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF059669' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    }
    cell.alignment = {
      vertical: 'middle',
      horizontal: col === 7 ? 'right' : col === 6 ? 'right' : 'center',
      wrapText: false,
    }
  }
  totalRow.getCell(7).numFmt = '"$"#,##0.00'

  if (hoja.filas.length > 0) {
    ws.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4 + hoja.filas.length, column: 7 },
    }
  }

  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  }
}

export async function exportarPagosInternosExcel(opts: {
  hojas: HojaExportPagoInterno[]
}): Promise<void> {
  const hojas = opts.hojas.filter((h) => h.filas.length >= 0)
  if (hojas.length === 0) return

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Servicios Administrativos'
  workbook.created = new Date()

  const hoy = new Date()
  const fechaGen = hoy.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  for (const hoja of hojas) {
    escribirHoja(workbook, hoja, fechaGen)
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
