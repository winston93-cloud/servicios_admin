import ExcelJS from 'exceljs'
import { etiquetaDia, etiquetaNivel, hora12, textoDuracion, type ReporteHorasMaestros } from '@/lib/talleres/talleresTypes'

const NAVY = 'FF1E3A5F'
const NAVY_SUAVE = 'FFE8EEF6'
const CIAN_SUAVE = 'FFD9F6FB'
const GRIS = 'FFF4F6FA'
const BORDE = 'FFD5DCE6'
const TEXTO = 'FF13233A'
const MUTED = 'FF64748B'

const borde: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: BORDE } },
  bottom: { style: 'thin', color: { argb: BORDE } },
  left: { style: 'thin', color: { argb: BORDE } },
  right: { style: 'thin', color: { argb: BORDE } },
}

function fechaCorta(f: string): string {
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

function fechaDia(f: string): string {
  const [, m, d] = f.split('-')
  return `${d}/${m}`
}

function nombreGrupo(taller: string, niveles: number[], nivel: number): string {
  const otros = niveles.filter((n) => n !== nivel)
  return otros.length ? `${taller} (compartido con ${otros.map(etiquetaNivel).join(' y ')})` : taller
}

function horas(minutos: number): number {
  return Math.round((minutos / 60) * 100) / 100
}

function hhmm(minutos: number): string {
  return `${Math.floor(minutos / 60)}:${String(minutos % 60).padStart(2, '0')}`
}

function encabezado(
  ws: ExcelJS.Worksheet,
  columnas: number,
  subtitulo: string,
  r: ReporteHorasMaestros,
  generadoPor: string,
  generado: string
): number {
  const ultima = ws.getColumn(columnas).letter
  const filas: [string, Partial<ExcelJS.Font>, number][] = [
    ['INSTITUTO WINSTON CHURCHILL', { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }, 28],
    [`Talleres y Clases Especiales · ${subtitulo}`, { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }, 20],
  ]
  filas.forEach(([texto, font, alto], i) => {
    const n = i + 1
    ws.mergeCells(`A${n}:${ultima}${n}`)
    const c = ws.getCell(`A${n}`)
    c.value = texto
    c.font = { name: 'Calibri', ...font }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    ws.getRow(n).height = alto
  })
  const datos: [string, string][] = [
    ['Nivel', etiquetaNivel(r.nivel)],
    ['Periodo', `${fechaCorta(r.desde)} al ${fechaCorta(r.hasta)}`],
    ['Ciclo escolar', r.ciclo.nombre],
    ['Generado', `${generado} · ${generadoPor}`],
  ]
  datos.forEach(([k, v], i) => {
    const n = 3 + i
    ws.mergeCells(`A${n}:${ultima}${n}`)
    ws.getCell(`A${n}`).value = {
      richText: [
        { text: `${k}:  `, font: { bold: true, size: 10, color: { argb: MUTED } } },
        { text: v, font: { size: 10, color: { argb: TEXTO } } },
      ],
    }
    ws.getCell(`A${n}`).alignment = { indent: 1 }
    for (let col = 1; col <= columnas; col++) {
      ws.getRow(n).getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_SUAVE } }
    }
  })
  return 8
}

function filaTitulos(ws: ExcelJS.Worksheet, fila: number, titulos: string[]) {
  const row = ws.getRow(fila)
  titulos.forEach((t, i) => {
    const c = row.getCell(i + 1)
    c.value = t
    c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    c.border = borde
  })
  row.height = 30
}

function configurarHoja(ws: ExcelJS.Worksheet, filaTitulo: number) {
  ws.views = [{ state: 'frozen', ySplit: filaTitulo, showGridLines: false }]
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    printTitlesRow: `${filaTitulo}:${filaTitulo}`,
  }
  ws.headerFooter.oddFooter = '&L&8Instituto Winston Churchill · Talleres&R&8Página &P de &N'
}

export async function excelHorasMaestros(
  r: ReporteHorasMaestros,
  generadoPor: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Servicios Administrativos · Winston'
  wb.created = new Date()
  const generado = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date())

  /* ── Resumen ── */
  const res = wb.addWorksheet('Resumen', { properties: { tabColor: { argb: NAVY } } })
  res.columns = [
    { width: 6 },
    { width: 34 },
    { width: 36 },
    { width: 11 },
    { width: 11 },
    { width: 11 },
    { width: 11 },
    { width: 60 },
  ]
  let f = encabezado(res, 8, 'Horas impartidas por maestro', r, generadoPor, generado)
  filaTitulos(res, f, ['No.', 'Maestro', 'Talleres', 'Días con clase', 'Sesiones', 'Horas', 'Tiempo (h:mm)', 'Días de clase'])
  const filaTitulo = f
  r.maestros.forEach((m, i) => {
    f++
    const row = res.getRow(f)
    row.values = [
      i + 1,
      m.nombre,
      m.grupos.map((g) => nombreGrupo(g.taller, g.niveles, r.nivel)).join('\n'),
      m.dias.length,
      m.sesiones,
      horas(m.minutos),
      hhmm(m.minutos),
      m.dias.map(fechaDia).join(', '),
    ]
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = borde
      c.font = { size: 10, color: { argb: TEXTO }, bold: col === 2 || col === 6 }
      c.alignment = { vertical: 'top', wrapText: true, horizontal: col === 1 || (col >= 4 && col <= 7) ? 'center' : 'left' }
      if (i % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
    })
    row.getCell(6).numFmt = '0.00'
  })
  if (!r.maestros.length) {
    f++
    res.mergeCells(`A${f}:H${f}`)
    res.getCell(`A${f}`).value = 'Sin clases con asistencia registrada en el periodo.'
    res.getCell(`A${f}`).font = { italic: true, color: { argb: MUTED } }
    res.getCell(`A${f}`).alignment = { horizontal: 'center' }
  }
  f++
  const total = res.getRow(f)
  total.values = [
    '',
    'TOTAL',
    `${r.maestros.length} ${r.maestros.length === 1 ? 'maestro' : 'maestros'}`,
    '',
    r.total_sesiones,
    horas(r.total_minutos),
    hhmm(r.total_minutos),
    textoDuracion(r.total_minutos),
  ]
  total.eachCell({ includeEmpty: true }, (c, col) => {
    c.font = { bold: true, size: 11, color: { argb: NAVY } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CIAN_SUAVE } }
    c.border = { ...borde, top: { style: 'medium', color: { argb: NAVY } } }
    c.alignment = { vertical: 'middle', horizontal: col >= 4 && col <= 7 ? 'center' : 'left' }
  })
  total.getCell(6).numFmt = '0.00'
  total.height = 22
  if (r.maestros.length) res.autoFilter = { from: { row: filaTitulo, column: 1 }, to: { row: f - 1, column: 8 } }

  f += 2
  const nota = res.getCell(`A${f}`)
  res.mergeCells(`A${f}:H${f}`)
  nota.value =
    'Solo se cuentan los días con asistencia guardada. La duración de cada clase se toma del horario del grupo para ese día de la semana.' +
    (r.sin_horario
      ? ` ${r.sin_horario} ${r.sin_horario === 1 ? 'registro' : 'registros'} de asistencia en días sin horario no suman horas (ver hoja Detalle).`
      : '')
  nota.font = { size: 9, italic: true, color: { argb: MUTED } }
  nota.alignment = { wrapText: true }
  res.getRow(f).height = 28

  f += 4
  for (const [col, rotulo] of [
    ['B', 'Elaboró'],
    ['D', 'Revisó (Dirección)'],
    ['H', 'Autorizó (Contabilidad)'],
  ] as const) {
    const c = res.getCell(`${col}${f}`)
    c.value = rotulo
    c.font = { size: 10, color: { argb: MUTED } }
    c.alignment = { horizontal: 'center' }
    c.border = { top: { style: 'thin', color: { argb: TEXTO } } }
  }
  res.mergeCells(`D${f}:F${f}`)
  configurarHoja(res, filaTitulo)

  /* ── Detalle ── */
  const det = wb.addWorksheet('Detalle', { properties: { tabColor: { argb: 'FF00B8D4' } } })
  det.columns = [{ width: 32 }, { width: 36 }, { width: 13 }, { width: 12 }, { width: 22 }, { width: 10 }, { width: 12 }]
  f = encabezado(det, 7, 'Detalle de clases impartidas', r, generadoPor, generado)
  const filaTituloDet = f
  filaTitulos(det, f, ['Maestro', 'Taller', 'Fecha', 'Día', 'Horario', 'Horas', 'Alumnos en clase'])
  for (const m of r.maestros) {
    f++
    det.mergeCells(`A${f}:G${f}`)
    const c = det.getCell(`A${f}`)
    c.value = `${m.nombre} · ${m.dias.length} ${m.dias.length === 1 ? 'día' : 'días'} · ${textoDuracion(m.minutos)}`
    c.font = { bold: true, size: 10, color: { argb: NAVY } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_SUAVE } }
    const sesiones = m.grupos
      .flatMap((g) => g.sesiones.map((s) => ({ g, s })))
      .sort((x, y) => x.s.fecha.localeCompare(y.s.fecha) || x.g.taller.localeCompare(y.g.taller, 'es'))
    sesiones.forEach(({ g, s }, i) => {
      f++
      const row = det.getRow(f)
      row.values = [
        m.nombre,
        nombreGrupo(g.taller, g.niveles, r.nivel),
        fechaCorta(s.fecha),
        etiquetaDia(s.dia),
        s.hora_inicio && s.hora_fin ? `${hora12(s.hora_inicio)} – ${hora12(s.hora_fin)}` : 'Sin horario ese día',
        horas(s.minutos),
        s.alumnos ?? '—',
      ]
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.border = borde
        cell.font = { size: 10, color: { argb: s.minutos ? TEXTO : 'FFB45309' } }
        cell.alignment = { vertical: 'middle', horizontal: col >= 3 ? 'center' : 'left' }
        if (i % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
      })
      row.getCell(6).numFmt = '0.00'
    })
    f++
    const sub = det.getRow(f)
    sub.values = ['', '', '', '', 'Subtotal', horas(m.minutos), '']
    sub.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { bold: true, size: 10, color: { argb: NAVY } }
      cell.alignment = { horizontal: col >= 5 ? 'center' : 'left' }
      cell.border = { top: { style: 'thin', color: { argb: NAVY } } }
    })
    sub.getCell(6).numFmt = '0.00'
  }
  f++
  const totDet = det.getRow(f)
  totDet.values = ['TOTAL', '', '', '', `${r.total_sesiones} sesiones`, horas(r.total_minutos), '']
  totDet.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.font = { bold: true, size: 11, color: { argb: NAVY } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CIAN_SUAVE } }
    cell.border = { ...borde, top: { style: 'medium', color: { argb: NAVY } } }
    cell.alignment = { horizontal: col >= 5 ? 'center' : 'left' }
  })
  totDet.getCell(6).numFmt = '0.00'
  configurarHoja(det, filaTituloDet)

  /* ── Calendario ── */
  const fechas = [...new Set(r.maestros.flatMap((m) => m.dias))].sort()
  const cal = wb.addWorksheet('Calendario', { properties: { tabColor: { argb: 'FFF5B942' } } })
  const cols = Math.max(3, fechas.length + 2)
  const anchoDia = Math.max(7.5, Math.min(14, 60 / Math.max(1, fechas.length)))
  cal.columns = [{ width: 34 }, ...fechas.map(() => ({ width: anchoDia })), { width: 12 }]
  f = encabezado(cal, cols, 'Calendario de horas por día', r, generadoPor, generado)
  const filaTituloCal = f
  filaTitulos(cal, f, [
    'Maestro',
    ...fechas.map((d) => `${etiquetaDia(new Date(`${d}T12:00:00Z`).getUTCDay()).slice(0, 3)}\n${fechaDia(d)}`),
    'Total horas',
  ])
  cal.getRow(f).height = 34
  r.maestros.forEach((m, i) => {
    f++
    const porDia = new Map<string, number>()
    for (const g of m.grupos) for (const s of g.sesiones) porDia.set(s.fecha, (porDia.get(s.fecha) ?? 0) + s.minutos)
    const row = cal.getRow(f)
    row.values = [m.nombre, ...fechas.map((d) => (porDia.has(d) ? horas(porDia.get(d)!) : '')), horas(m.minutos)]
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = borde
      cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'center' }
      cell.font = { size: 10, color: { argb: TEXTO }, bold: col === 1 || col === fechas.length + 2 }
      const conClase = col > 1 && col <= fechas.length + 1 && cell.value !== ''
      if (conClase) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CIAN_SUAVE } }
      else if (i % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
      if (col > 1) cell.numFmt = '0.##'
    })
  })
  f++
  const totCal = cal.getRow(f)
  const totalDia = fechas.map((d) =>
    horas(r.maestros.reduce((s, m) => s + m.grupos.reduce((x, g) => x + g.sesiones.filter((ss) => ss.fecha === d).reduce((y, ss) => y + ss.minutos, 0), 0), 0))
  )
  totCal.values = ['TOTAL', ...totalDia, horas(r.total_minutos)]
  totCal.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.font = { bold: true, size: 10, color: { argb: NAVY } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CIAN_SUAVE } }
    cell.border = { ...borde, top: { style: 'medium', color: { argb: NAVY } } }
    cell.alignment = { horizontal: col === 1 ? 'left' : 'center' }
    if (col > 1) cell.numFmt = '0.##'
  })
  configurarHoja(cal, filaTituloCal)
  cal.views = [{ state: 'frozen', xSplit: 1, ySplit: filaTituloCal, showGridLines: false }]

  return Buffer.from(await wb.xlsx.writeBuffer())
}
