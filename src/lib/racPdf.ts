import { readFileSync } from 'fs'
import { join } from 'path'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { etiquetaCicloBoletas } from '@/lib/boletasCiclo'
import { etiquetaEscalon, etiquetaTipoReporte, motivoReporte } from '@/lib/racCatalogo'

export type FilaPdfReporte = {
  reporte_id: number
  nombre: string
  materia: string
  departamento: string
  reporteLabel: string
  motivo: string
  fecha: string
  enviado: boolean
  confirmado: boolean
  vuelta: number
}

function logoBase64(): string | null {
  try {
    const buf = readFileSync(join(process.cwd(), 'public/logos/logo-winston-churchill.png'))
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

function encabezadoPdf(doc: jsPDF, titulo: string, ciclo: number) {
  const logo = logoBase64()
  if (logo) doc.addImage(logo, 'PNG', 10, 5, 42, 18)
  doc.setFont('times', 'normal')
  doc.setFontSize(14)
  doc.text(titulo, 200, 12, { align: 'right' })
  doc.setFontSize(11)
  doc.text(`Ciclo escolar ${etiquetaCicloBoletas(ciclo)}`, 200, 20, { align: 'right' })
  doc.text(new Date().toLocaleDateString('es-MX'), 200, 26, { align: 'right' })
  doc.setFontSize(8)
  doc.text('Donde: RE = Reporte enviado, RC = Reporte confirmado.', 200, 32, { align: 'right' })
}

function tablaReportes(doc: jsPDF, filas: FilaPdfReporte[], startY: number) {
  autoTable(doc, {
    startY,
    head: [['#', 'ID', 'Nombre', 'Materia', 'Reporte', 'Motivo', 'Fecha', 'RE', 'RC', 'Vuelta']],
    body: filas.map((f, i) => [
      String(i + 1),
      String(f.reporte_id),
      f.nombre.slice(0, 35),
      (f.materia || f.departamento).slice(0, 24),
      f.reporteLabel,
      f.motivo.slice(0, 30),
      f.fecha,
      f.enviado ? 'SI' : 'NO',
      f.confirmado ? 'SI' : 'NO',
      String(f.vuelta),
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [168, 168, 168], textColor: 0 },
    margin: { left: 10, right: 10 },
  })
}

export function pdfReportesPendientes(opts: {
  ciclo: number
  reportes: FilaPdfReporte[]
  informes: FilaPdfReporte[]
}): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [210, 279] })
  encabezadoPdf(doc, 'Reportes sin confirmar', opts.ciclo)
  tablaReportes(doc, opts.reportes, 40)
  doc.addPage()
  encabezadoPdf(doc, 'Informes sin confirmar', opts.ciclo)
  tablaReportes(doc, opts.informes, 40)
  return Buffer.from(doc.output('arraybuffer'))
}

export function pdfHistorialAlumno(opts: {
  ciclo: number
  alumnoNombre: string
  filas: FilaPdfReporte[]
}): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [210, 279] })
  encabezadoPdf(doc, `Historial de reportes — ${opts.alumnoNombre}`, opts.ciclo)
  autoTable(doc, {
    startY: 40,
    head: [['#', 'Nombre', 'Reporte', 'Materia', 'Motivo', 'Fecha', 'Vuelta', 'RE', 'RC']],
    body: opts.filas.map((f, i) => [
      String(i + 1),
      f.nombre.slice(0, 40),
      f.reporteLabel,
      f.materia.slice(0, 30),
      f.motivo.slice(0, 30),
      f.fecha,
      String(f.vuelta),
      f.enviado ? 'SI' : 'NO',
      f.confirmado ? 'SI' : 'NO',
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [168, 168, 168], textColor: 0 },
    margin: { left: 10, right: 10 },
  })
  return Buffer.from(doc.output('arraybuffer'))
}

export function filaPdfDesdeReporte(r: {
  reporte_id: number
  nombre: string
  materia?: string
  departamento?: string
  tipo: number
  no: number
  motivo: string
  fecha: string
  enviado: boolean
  confirmado: boolean
  vuelta: number
}): FilaPdfReporte {
  const tipo = r.tipo
  const no = r.no
  let reporteLabel = ''
  if (tipo === 5 || tipo === 8) reporteLabel = etiquetaTipoReporte(tipo)
  else if (tipo > 2) reporteLabel = `${etiquetaTipoReporte(tipo)} ${no || ''}`.trim()
  else if (no <= 0) reporteLabel = `Aviso ${etiquetaTipoReporte(tipo)}`
  else reporteLabel = `Reporte ${etiquetaTipoReporte(tipo)} ${no}`
  return {
    reporte_id: r.reporte_id,
    nombre: r.nombre,
    materia: r.materia ?? '',
    departamento: r.departamento ?? '',
    reporteLabel,
    motivo: r.motivo,
    fecha: r.fecha,
    enviado: r.enviado,
    confirmado: r.confirmado,
    vuelta: r.vuelta,
  }
}

export { etiquetaEscalon, etiquetaTipoReporte, motivoReporte }
