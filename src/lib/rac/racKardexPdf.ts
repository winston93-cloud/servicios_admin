import { jsPDF } from 'jspdf'
import autoTable, { type CellHookData } from 'jspdf-autotable'
import { logoBase64 } from '@/lib/racPdf'
import {
  etiquetaVuelta,
  fechaKardex,
  type KardexAlumno,
  type KardexGrupo,
  type KardexRenglon,
} from './racKardex'

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function fechaLarga(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`
}

const ROMANOS = ['I', 'II', 'III', 'IV', 'V']
const AZUL: [number, number, number] = [30, 58, 95]
const TINTA: [number, number, number] = [15, 23, 42]
const GRIS: [number, number, number] = [148, 163, 184]
/** Aviso → Reporte III+: de amarillo a rojo, para ver de un vistazo qué tan avanzado va. */
const TONOS: [number, number, number][] = [
  [254, 243, 199],
  [254, 215, 170],
  [253, 186, 116],
  [252, 165, 165],
  [252, 165, 165],
  [252, 165, 165],
]

function filas(renglones: KardexRenglon[], columnas: number): string[][] {
  return renglones.map((r) => {
    const reps = Array.from({ length: columnas }, (_, i) =>
      i < r.reportes.length ? fechaKardex(r.reportes[i]) : '—'
    )
    return [
      r.etiqueta,
      r.informes === null ? '' : r.informes ? String(r.informes) : '',
      r.aviso === null ? '—' : fechaKardex(r.aviso),
      ...reps,
      etiquetaVuelta(r.vuelta),
    ]
  })
}

function tabla(doc: jsPDF, titulo: string, renglones: KardexRenglon[], columnas: number, startY: number): number {
  const head = ['STATUS', 'INFORMES', 'AVISO', ...ROMANOS.slice(0, columnas).map((r) => `REP. ${r}`), 'VUELTA']
  const ultima = head.length - 1
  autoTable(doc, {
    startY,
    head: [
      [{ content: titulo, colSpan: head.length, styles: { halign: 'center', fillColor: AZUL, textColor: 255 } }],
      head,
    ],
    body: filas(renglones, columnas),
    theme: 'grid',
    styles: { fontSize: 7.6, cellPadding: 1.4, textColor: TINTA, lineColor: [203, 213, 225], lineWidth: 0.2 },
    headStyles: { fillColor: [226, 232, 240], textColor: TINTA, fontStyle: 'bold', fontSize: 7.2 },
    columnStyles: {
      0: { cellWidth: 62, fontStyle: 'bold' },
      1: { cellWidth: 17, halign: 'center' },
      [ultima]: { cellWidth: 22, halign: 'center' },
    },
    margin: { left: 12, right: 12 },
    didParseCell: (data: CellHookData) => {
      if (data.section !== 'body') return
      const col = data.column.index
      const texto = String(data.cell.raw ?? '')
      if (col >= 2 && col < ultima) {
        data.cell.styles.halign = 'center'
        if (texto === '—') data.cell.styles.textColor = GRIS
        else if (texto) data.cell.styles.fillColor = TONOS[col - 2]
      }
      if (col === ultima && texto) {
        data.cell.styles.textColor = [185, 28, 28]
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

function hojaAlumno(doc: jsPDF, grupo: KardexGrupo, alumno: KardexAlumno, logo: string | null) {
  if (logo) doc.addImage(logo, 'PNG', 12, 8, 55, 25)
  doc.setTextColor(...TINTA)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text('KARDEX DEL ALUMNO', 204, 15, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(`${grupo.nivelEtiqueta} · Ciclo escolar ${grupo.cicloEtiqueta}`, 204, 21, { align: 'right' })
  doc.text(`Reporte al ${fechaLarga(grupo.fechaCorte)}`, 204, 26.5, { align: 'right' })

  doc.setFillColor(241, 245, 249)
  doc.roundedRect(12, 36, 192, 13, 2, 2, 'F')
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  doc.text('ALUMNO', 16, 40.5)
  doc.text('GRADO Y GRUPO', 128, 40.5)
  doc.text('MATRÍCULA', 172, 40.5)
  doc.setFontSize(10.5)
  doc.setTextColor(...TINTA)
  doc.setFont('helvetica', 'bold')
  doc.text(alumno.nombre.slice(0, 52), 16, 46)
  doc.text(alumno.grupoEtiqueta, 128, 46)
  doc.text(alumno.alumno_ref || '—', 172, 46)
  doc.setFont('helvetica', 'normal')

  let y = tabla(doc, 'ACADÉMICO', alumno.academico, 3, 54)
  y = tabla(doc, 'CONDUCTUAL Y OTROS', alumno.conductual, grupo.columnasConductual, y + 6)

  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  const nota = [
    'Solo reportes validados del ciclo escolar. Informes = informes académicos de la materia.',
    'Uniforme, vialidad y retardo empiezan en Reporte I (no tienen aviso). Después del Reporte III el escalón vuelve a empezar:',
    'la columna Vuelta indica en cuál va el alumno y las fechas son siempre de la última vuelta.',
  ]
  doc.text(nota, 12, Math.min(y + 8, 262))
  doc.text('Documento interno · Instituto Winston Churchill / Instituto Educativo Winston', 108, 272, {
    align: 'center',
  })
}

export function pdfKardex(grupo: KardexGrupo): Buffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const logo = logoBase64()
  if (!grupo.alumnos.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(`Sin alumnos en ${grupo.grupoEtiqueta}.`, 14, 20)
  }
  grupo.alumnos.forEach((a, i) => {
    if (i > 0) doc.addPage()
    hojaAlumno(doc, grupo, a, logo)
  })
  return Buffer.from(doc.output('arraybuffer'))
}
