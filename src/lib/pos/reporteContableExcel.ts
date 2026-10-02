import ExcelJS from 'exceljs'
import { dateAFechaIso, fechaIsoADate, sumarDias, type PosReporteContable } from './posTipos'

const COLORES = [
  'FFFFE4CC', 'FFD9E1F2', 'FFE2EFDA', 'FFD9E1F2', 'FFFCE4D6',
  'FFD9E1F2', 'FFE2EFDA', 'FFF2F2F2', 'FFD9D9D9', 'FFC6E0B4',
]
const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
const MONEDA = '"$"#,##0.00'
const NEGRO: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }
const BORDE: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
}

const relleno = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })

function enesimoLunes(anio: number, mes: number, n: number): string {
  const d = new Date(anio, mes, 1, 12)
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1)
  d.setDate(d.getDate() + 7 * (n - 1))
  return dateAFechaIso(d)
}

/** Descansos obligatorios de la Ley Federal del Trabajo (los días SEP adicionales se capturan aparte). */
function asuetosOficiales(anio: number): Set<string> {
  const p = (m: number, d: number) => `${anio}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return new Set([
    p(1, 1),
    enesimoLunes(anio, 1, 1),
    enesimoLunes(anio, 2, 3),
    p(5, 1),
    p(9, 16),
    enesimoLunes(anio, 10, 3),
    p(12, 25),
  ])
}

function diasLaboralesDelMes(anio: number, mes: number): number {
  const asuetos = asuetosOficiales(anio)
  const ultimo = new Date(anio, mes + 1, 0).getDate()
  let n = 0
  for (let dia = 1; dia <= ultimo; dia++) {
    const d = new Date(anio, mes, dia, 12)
    if (d.getDay() !== 0 && d.getDay() !== 6 && !asuetos.has(dateAFechaIso(d))) n++
  }
  return n
}

type FilaServicio = { codigo: string; precio: number; ludi: number; color: string }

function serviciosDelReporte(rep: PosReporteContable): FilaServicio[] {
  const filas: FilaServicio[] = rep.catalogo
    .filter((p) => p.codigoReporte && (p.activo || rep.dias.some((d) => d.servicios.some((s) => s.codigo === p.codigoReporte))))
    .map((p, i) => ({ codigo: p.codigoReporte as string, precio: p.costo, ludi: p.montoLudi, color: COLORES[i % COLORES.length] }))
  const conocidos = new Set(filas.map((f) => f.codigo))
  for (const d of rep.dias) {
    for (const s of d.servicios) {
      if (conocidos.has(s.codigo)) continue
      conocidos.add(s.codigo)
      filas.push({ codigo: s.codigo, precio: s.precio, ludi: s.ludiUnitario, color: 'FFF2F2F2' })
    }
  }
  return filas
}

function tablaEtiquetaValor(ws: ExcelJS.Worksheet, fila: number, etiqueta: string, valor: number | null, color: string, tam = 10) {
  ws.mergeCells(`J${fila}:K${fila}`)
  for (const col of ['J', 'K', 'L']) {
    const c = ws.getCell(`${col}${fila}`)
    c.border = BORDE
    c.fill = relleno('FFFFFFFF')
  }
  const l = ws.getCell(`J${fila}`)
  l.value = etiqueta
  l.font = { bold: true, size: tam, color: { argb: 'FF1E293B' } }
  l.alignment = { horizontal: 'left', vertical: 'middle' }
  const v = ws.getCell(`L${fila}`)
  v.value = valor
  v.font = { bold: true, size: tam, color: { argb: color } }
  v.alignment = { horizontal: 'right', vertical: 'middle' }
  v.numFmt = MONEDA
}

function cajaCaptura(ws: ExcelJS.Worksheet, filaTitulo: number, titulo: string, color: string, resaltar = false) {
  ws.mergeCells(`N${filaTitulo}:O${filaTitulo}`)
  ws.mergeCells(`N${filaTitulo + 1}:O${filaTitulo + 1}`)
  for (const f of [filaTitulo, filaTitulo + 1]) {
    for (const col of ['N', 'O']) ws.getCell(`${col}${f}`).border = BORDE
  }
  const t = ws.getCell(`N${filaTitulo}`)
  t.value = titulo
  t.font = { bold: true, size: 10, color: { argb: color } }
  t.alignment = { horizontal: 'center', vertical: 'middle' }
  t.fill = relleno('FFF3F4F6')
  const v = ws.getCell(`N${filaTitulo + 1}`)
  v.numFmt = MONEDA
  v.alignment = { horizontal: 'center', vertical: 'middle' }
  if (resaltar) v.fill = relleno('FFFFFF00')
}

/** Excel con el formato de contabilidad: una hoja por día del rango + hoja TOTAL MES. */
export async function exportarReporteContableExcel(rep: PosReporteContable): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const servicios = serviciosDelReporte(rep)

  for (let fecha = rep.inicio; fecha <= rep.fin; fecha = sumarDias(fecha, 1)) {
    const d = fechaIsoADate(fecha)
    const dia = rep.dias.find((x) => x.fecha === fecha)
    const ws = wb.addWorksheet(`Día ${d.getDate()}${rep.inicio.slice(0, 7) !== rep.fin.slice(0, 7) ? ` ${MESES[d.getMonth()]}` : ''}`)
    ws.columns = [
      { width: 35 }, { width: 12 }, { width: 15 }, { width: 15 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 10 },
      { width: 4 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 10 },
    ]

    const header = ws.getRow(1)
    header.values = ['DÍAS POR MES', 'PAGADOS', 'SERVICIO', 'INGRESO', '$ LUDI', 'CAJA', '% LUDI', '% CAJA']
    header.eachCell((c) => {
      c.fill = relleno('FF4472C4')
      c.font = { color: { argb: 'FFFFFFFF' }, bold: true }
      c.alignment = { horizontal: 'center', vertical: 'middle' }
    })

    servicios.forEach((s, i) => {
      const venta = dia?.servicios.find((x) => x.codigo === s.codigo)
      const row = ws.getRow(2 + i)
      row.values = [
        '',
        venta?.cantidad ?? 0,
        s.codigo,
        venta?.total ?? 0,
        venta?.ludi ?? 0,
        venta?.caja ?? 0,
        s.precio > 0 ? s.ludi / s.precio : 0,
        s.precio > 0 ? (s.precio - s.ludi) / s.precio : 0,
      ]
      row.eachCell({ includeEmpty: true }, (c, col) => {
        if (col > 8) return
        c.alignment = { horizontal: 'center', vertical: 'middle' }
        if (col === 1) {
          c.fill = NEGRO
          c.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 18 }
          return
        }
        c.fill = relleno(s.color)
        c.font = { color: { argb: 'FF000000' } }
        if (col >= 4 && col <= 6) c.numFmt = MONEDA
        if (col >= 7) c.numFmt = '0%'
      })
    })

    if (servicios.length >= 3) ws.getCell(4, 1).value = MESES[d.getMonth()]
    if (servicios.length >= 6) ws.getCell(7, 1).value = d.getDate()

    const filaTotales = 2 + servicios.length
    const tot = ws.getRow(filaTotales)
    tot.values = [
      'Aquí NO se ingresan estancias mensuales pagadas hoy',
      '',
      '',
      dia?.totalVendido ?? 0,
      dia?.totalLudi ?? 0,
      dia?.totalCaja ?? 0,
    ]
    tot.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
    for (let col = 4; col <= 6; col++) {
      const c = tot.getCell(col)
      c.fill = relleno('FF70AD47')
      c.font = { color: { argb: 'FFFFFFFF' }, bold: true }
      c.alignment = { horizontal: 'center', vertical: 'middle' }
      c.numFmt = MONEDA
    }

    tablaEtiquetaValor(ws, 2, 'MENOS ADELANTOS Y DEVOLUCIONES', null, 'FFDC2626')
    tablaEtiquetaValor(ws, 3, 'TOTAL CAJA', null, 'FF059669')
    tablaEtiquetaValor(ws, 4, 'TOTAL LUDI', null, 'FF059669')
    cajaCaptura(ws, 2, 'DEVS. WINSTON', 'FF1E40AF')
    cajaCaptura(ws, 4, 'DEVS. LUDI', 'FF7C3AED')

    tablaEtiquetaValor(ws, 6, 'TOTAL VENDIDO', dia?.totalVendido ?? 0, 'FF059669', 12)
    tablaEtiquetaValor(ws, 7, 'TOTAL CAJA', dia?.totalCaja ?? 0, 'FF059669', 12)
    tablaEtiquetaValor(ws, 8, 'TOTAL LUDI', dia?.totalLudi ?? 0, 'FF059669', 12)
    const m6 = ws.getCell('M6')
    m6.value = MESES[d.getMonth()]
    const m7 = ws.getCell('M7')
    m7.value = d.getDate()
    for (const c of [m6, m7]) {
      c.font = { bold: true, size: 13, color: { argb: 'FF7C3AED' } }
      c.alignment = { horizontal: 'center', vertical: 'middle' }
    }
    cajaCaptura(ws, 6, 'OTRO INGRESO', 'FF000000', true)

    ws.mergeCells('J11:P11')
    const est = ws.getCell('J11')
    est.value = `DÍAS EST MENSUAL: ${diasLaboralesDelMes(d.getFullYear(), d.getMonth())} días`
    est.font = { bold: true, size: 13, color: { argb: 'FF1E293B' } }
    est.alignment = { horizontal: 'center', vertical: 'middle' }
    est.fill = relleno('FFF8FAFC')
    for (let col = 10; col <= 16; col++) {
      ws.getCell(10, col).fill = relleno('FF64748B')
      ws.getCell(12, col).fill = relleno('FF64748B')
    }
  }

  const total = wb.addWorksheet('TOTAL MES')
  total.columns = [{ width: 24 }, { width: 18 }]
  total.addRow(['TOTAL DEL PERIODO', `${rep.inicio} a ${rep.fin}`]).font = { bold: true }
  total.addRow(['Total vendido', rep.totalVendido])
  total.addRow(['Total caja', rep.totalCaja])
  total.addRow(['Total Ludi', rep.totalLudi])
  total.addRow(['Clientes distintos', rep.totalClientes])
  for (let r = 2; r <= 4; r++) total.getCell(r, 2).numFmt = MONEDA

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `REPORTE_CONTABLE_${rep.inicio}_${rep.fin}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
