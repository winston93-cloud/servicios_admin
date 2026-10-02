import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fechaIsoADate, type PosPago, type PosProducto } from './posTipos'

type Persona = { nombre: string; pagos: PosPago[] }

function precio(catalogo: PosProducto[], codigo: string, respaldo: string): string {
  const p =
    catalogo.find((c) => c.codigoReporte === codigo) ??
    catalogo.find((c) => c.nombre.toUpperCase().includes(respaldo))
  return p ? `$${Math.round(p.costo)}` : ''
}

function cantidadDe(pagos: PosPago[], pred: (p: PosPago) => boolean): number {
  return pagos.filter(pred).reduce((s, p) => s + p.cantidad, 0)
}

const esDesayuno = (p: PosPago) =>
  p.codigo === 'DCH' || p.codigo === 'DG' || /desayuno/i.test(p.descripcion)
const esCh = (p: PosPago) => p.codigo === 'DCH' || /desayuno ch/i.test(p.descripcion)
const servicio = (p: PosPago) => (p.codigo || p.descripcion).toUpperCase()

function agruparPorPersona(pagos: PosPago[]): Persona[] {
  const mapa = new Map<string, Persona>()
  for (const p of pagos) {
    const actual = mapa.get(p.ref) ?? { nombre: p.cliente, pagos: [] }
    actual.pagos.push(p)
    mapa.set(p.ref, actual)
  }
  return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

function columna(personas: Persona[], etiqueta?: (p: Persona) => string): string[] {
  return personas.map((p) => (etiqueta ? etiqueta(p) : p.nombre))
}

function paginaDesayunos(pdf: jsPDF, fechaTitulo: string, pagos: PosPago[], catalogo: PosProducto[]) {
  const desayunos = pagos.filter(esDesayuno)
  const de = (pred: (p: PosPago) => boolean) => agruparPorPersona(desayunos.filter(pred))
  const grado = (p: PosPago) => String(p.grado ?? '')
  const conTipo = (per: Persona) =>
    `${per.nombre} (${per.pagos.every(esCh) ? 'CH' : per.pagos.some(esCh) ? 'CH/GD' : 'GD'})`

  const secundaria = ['3', '2', '1'].map((g) =>
    columna(de((p) => p.tipo === 'alumno' && p.nivel === 4 && grado(p) === g))
  )
  const sexto = columna(de((p) => p.tipo === 'alumno' && p.nivel === 3 && grado(p) === '6'))
  const kinder = columna(
    de((p) => p.tipo === 'alumno' && (p.nivel === 1 || p.nivel === 2)),
    conTipo
  )
  const externos = columna(de((p) => p.tipo === 'externo'), conTipo)
  const maestros = columna(de((p) => p.tipo === 'maestro'), conTipo)
  const primaria = ['5', '4', '3', '2', '1'].map((g) =>
    columna(de((p) => p.tipo === 'alumno' && p.nivel === 3 && grado(p) === g))
  )

  const ch = precio(catalogo, 'DCH', 'DESAYUNO CH')
  const gd = precio(catalogo, 'DG', 'DESAYUNO GDE')
  const totales = [
    `DES. CH: ${cantidadDe(pagos, esCh)}`,
    `DES. GD: ${cantidadDe(pagos, (p) => esDesayuno(p) && !esCh(p))}`,
    `EST. 5PM: ${cantidadDe(pagos, (p) => servicio(p) === 'ESTANCIA 5')}`,
    `EST. 7PM: ${cantidadDe(pagos, (p) => servicio(p) === 'ESTANCIA 7')}`,
    `TAREA 5PM: ${cantidadDe(pagos, (p) => servicio(p) === 'TAREA 5' || /tareas? 5/i.test(p.descripcion))}`,
    `TAREA 7PM: ${cantidadDe(pagos, (p) => servicio(p) === 'TAREA 7' || /tareas? 7/i.test(p.descripcion))}`,
    `MEDIA: ${cantidadDe(pagos, (p) => servicio(p) === 'MEDIA')}`,
  ]
  const head = [
    totales,
    [`9° / 3° SEC  ${gd}`, `8° / 2° SEC  ${gd}`, `7° / 1° SEC  ${gd}`, 'KINDER / MATERNAL', `6°  ${gd}`, 'EXTERNOS', 'MAESTRAS'],
  ]

  const colsSup = [secundaria[0], secundaria[1], secundaria[2], kinder, sexto, externos, maestros]
  const filasSup = Math.max(12, ...colsSup.map((c) => c.length))
  const body: string[][] = []
  for (let i = 0; i < filasSup; i++) body.push(colsSup.map((c) => c[i] ?? ''))

  const filaPrecios = body.length
  body.push([`5°  ${gd}`, `4°  ${gd}`, `3°  ${ch}`, `2°  ${ch}`, `1°  ${ch}`, '', ''])
  const filasInf = Math.max(12, ...primaria.map((c) => c.length))
  for (let i = 0; i < filasInf; i++) body.push([...primaria.map((c) => c[i] ?? ''), '', ''])

  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`DESAYUNOS DEL DÍA: ${fechaTitulo}`, pdf.internal.pageSize.getWidth() / 2, 12, { align: 'center' })

  autoTable(pdf, {
    head,
    body,
    startY: 18,
    margin: { left: 3, right: 1 },
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 51 },
      1: { cellWidth: 51 },
      2: { cellWidth: 51 },
      3: { cellWidth: 43 },
      4: { cellWidth: 43 },
      5: { cellWidth: 43 },
      6: { cellWidth: 45 },
    },
    styles: { fontSize: 7, cellPadding: 1.5, halign: 'center', valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fillColor: [68, 114, 196], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
    didParseCell(data) {
      if (data.section === 'body' && data.row.index === filaPrecios) {
        data.cell.styles.fillColor = [68, 114, 196]
        data.cell.styles.textColor = [255, 255, 255]
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  const finalY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  if (finalY < pdf.internal.pageSize.getHeight() - 10) {
    pdf.setFontSize(12)
    pdf.text('NOTAS:', 10, finalY)
    pdf.setDrawColor(128, 128, 128)
    pdf.setLineWidth(0.5)
    pdf.line(10, finalY + 2, pdf.internal.pageSize.getWidth() - 10, finalY + 2)
  }
}

function bloque(titulo: string, personas: Persona[], sufijo: string): string[] {
  if (!personas.length) return []
  return [titulo, ...personas.map((p) => `${p.nombre}${sufijo}`)]
}

function paginaServicios(pdf: jsPDF, pagos: PosPago[], catalogo: PosProducto[]) {
  const de = (pred: (p: PosPago) => boolean) => agruparPorPersona(pagos.filter(pred))
  const colA = [
    ...bloque('ESTANCIA 5', de((p) => servicio(p) === 'ESTANCIA 5'), ' (5)'),
    ...bloque('ESTANCIA 7', de((p) => servicio(p) === 'ESTANCIA 7'), ' (7)'),
    ...bloque('ESTANCIA MENSUAL', de((p) => servicio(p).startsWith('EST. MES')), ''),
  ]
  const colB = columna(de((p) => servicio(p) === 'COMIDA' || /comida/i.test(p.descripcion)))
  const colC = [
    ...bloque('MEDIA', de((p) => servicio(p) === 'MEDIA'), ' (1/2)'),
    ...bloque('TAREA 5', de((p) => servicio(p) === 'TAREA 5' || /tareas? 5/i.test(p.descripcion)), ' (5)'),
    ...bloque('TAREA 7', de((p) => servicio(p) === 'TAREA 7' || /tareas? 7/i.test(p.descripcion)), ' (7)'),
  ]
  const filas = Math.max(25, colA.length, colB.length, colC.length)
  const body: string[][] = []
  for (let i = 0; i < filas; i++) body.push([colA[i] ?? '', colB[i] ?? '', colC[i] ?? ''])

  const titulos = new Set(['ESTANCIA 5', 'ESTANCIA 7', 'ESTANCIA MENSUAL', 'MEDIA', 'TAREA 5', 'TAREA 7'])
  const p = (c: string, n: string) => precio(catalogo, c, n)
  autoTable(pdf, {
    head: [
      [
        `ESTANCIA    5PM ${p('ESTANCIA 5', 'ESTANCIA 5')}  /  7PM ${p('ESTANCIA 7', 'ESTANCIA 7')}`,
        `COMIDA    ${p('COMIDA', 'COMIDA')}`,
        `TAREA    5PM ${p('TAREA 5', 'TAREAS 5')}  /  7PM ${p('TAREA 7', 'TAREAS 7')}  /  MEDIA ${p('MEDIA', 'MEDIA')}`,
      ],
    ],
    body,
    startY: 15,
    margin: { left: 3, right: 1 },
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 110, halign: 'left' },
      1: { cellWidth: 110, halign: 'left' },
      2: { cellWidth: 110, halign: 'left' },
    },
    styles: { fontSize: 7, cellPadding: 1.5, valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fillColor: [68, 114, 196], textColor: [255, 255, 255], fontSize: 10, fontStyle: 'bold', halign: 'center' },
    didParseCell(data) {
      if (data.section === 'body' && titulos.has(String(data.cell.raw ?? ''))) {
        data.cell.styles.fillColor = [211, 211, 211]
        data.cell.styles.textColor = [0, 0, 0]
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.halign = 'center'
      }
    },
  })
}

/** Genera el PDF de cocina (hoja de desayunos + estancias/comidas/tareas) y lo abre. */
export function generarReporteDiarioPdf(
  fecha: string,
  pagos: PosPago[],
  catalogo: PosProducto[],
  ventana?: Window | null
): void {
  const fechaTitulo = fechaIsoADate(fecha)
    .toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    .toUpperCase()

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' })
  paginaDesayunos(pdf, fechaTitulo, pagos, catalogo)
  pdf.addPage()
  paginaServicios(pdf, pagos, catalogo)

  const url = URL.createObjectURL(pdf.output('blob'))
  if (ventana && !ventana.closed) {
    ventana.location.href = url
  } else {
    const a = document.createElement('a')
    a.href = url
    a.download = `Reporte_Cocina_${fecha}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
