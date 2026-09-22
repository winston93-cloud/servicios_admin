import { readFileSync } from 'fs'
import { join } from 'path'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { etiquetaCicloBoletas } from '@/lib/boletasCiclo'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import {
  RAC_NIVEL_SECUNDARIA,
  etiquetaEscalon,
  etiquetaGradoStaffSecundaria,
  etiquetaTipoReporte,
  motivoReporte,
} from '@/lib/racCatalogo'

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
  /** Texto libre (informes académicos en historial). */
  mensaje?: string
  grado?: number
  grupo?: string
  nivel?: number
}

function logoBase64(): string | null {
  try {
    // Mismo asset horizontal que secundaria_2.0 (logo_full 688×311).
    const buf = readFileSync(join(process.cwd(), 'public/bauchers/logo_full.png'))
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

function encabezadoPdf(doc: jsPDF, titulo: string, ciclo: number) {
  const logo = logoBase64()
  // Caja 85×35 mm ≈ ratio 2.43:1 (logo 688×311 ≈ 2.21:1), como FPDF legacy.
  if (logo) doc.addImage(logo, 'PNG', 10, 5, 85, 35)
  doc.setFont('times', 'normal')
  doc.setFontSize(14)
  doc.text(titulo, 200, 12, { align: 'right' })
  doc.setFontSize(11)
  doc.text(`Ciclo escolar ${etiquetaCicloBoletas(ciclo)}`, 200, 20, { align: 'right' })
  doc.text(new Date().toLocaleDateString('es-MX'), 200, 26, { align: 'right' })
  doc.setFontSize(8)
  doc.text('Donde: RE = Reporte enviado, RC = Reporte confirmado.', 200, 32, { align: 'right' })
}

function etiquetaGradoPdf(f: FilaPdfReporte): string {
  if (!f.grado || f.grado <= 0) return '—'
  // Secundaria: 1→7mo, 2→8vo, 3→9no (mismo criterio que el panel de staff).
  if (f.nivel == null || f.nivel === 0 || f.nivel === RAC_NIVEL_SECUNDARIA) {
    return etiquetaGradoStaffSecundaria(f.grado)
  }
  return etiquetaGradoEscolar(f.nivel, f.grado) || `${f.grado}°`
}

function tablaReportes(doc: jsPDF, filas: FilaPdfReporte[], startY: number) {
  autoTable(doc, {
    startY,
    head: [['#', 'ID', 'Nombre', 'Grado', 'Grupo', 'Materia', 'Reporte', 'Motivo', 'Fecha', 'RE', 'RC', 'Vuelta']],
    body: filas.map((f, i) => [
      String(i + 1),
      String(f.reporte_id),
      f.nombre.slice(0, 32),
      etiquetaGradoPdf(f),
      (f.grupo ?? '').trim() || '—',
      (f.materia || f.departamento).slice(0, 22),
      f.reporteLabel,
      f.motivo.slice(0, 28),
      f.fecha,
      f.enviado ? 'SI' : 'NO',
      f.confirmado ? 'SI' : 'NO',
      String(f.vuelta),
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [168, 168, 168], textColor: 0 },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 12 },
      3: { cellWidth: 16 },
      4: { cellWidth: 12 },
      8: { cellWidth: 20 },
      9: { cellWidth: 10 },
      10: { cellWidth: 10 },
      11: { cellWidth: 12 },
    },
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
  tablaReportes(doc, opts.reportes, 42)
  doc.addPage()
  encabezadoPdf(doc, 'Informes sin confirmar', opts.ciclo)
  tablaReportes(doc, opts.informes, 42)
  return Buffer.from(doc.output('arraybuffer'))
}

export function pdfHistorialAlumno(opts: {
  ciclo: number
  alumnoNombre: string
  filas: FilaPdfReporte[]
  /**
   * @deprecated La hoja 2 ya usa el detalle de `filas` (observaciones de los reportes
   * de la hoja 1). Se mantiene por compatibilidad; si `filas` está vacío se usa como fallback.
   */
  informes?: FilaPdfReporte[]
  /** Título de portada. */
  titulo?: string
}): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [210, 279] })
  encabezadoPdf(doc, opts.titulo ?? `Historial de reportes — ${opts.alumnoNombre}`, opts.ciclo)
  if (!opts.filas.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Sin reportes en el ciclo actual para este filtro.', 14, 48)
  } else {
    autoTable(doc, {
      startY: 42,
      head: [['#', 'Nombre', 'Reporte', 'Materia', 'Motivo', 'Fecha', 'Vuelta', 'RE', 'RC']],
      body: opts.filas.map((f, i) => [
        String(i + 1),
        f.nombre.slice(0, 40),
        f.reporteLabel,
        (f.materia || f.departamento || '').slice(0, 30),
        (f.motivo ?? '').slice(0, 30),
        f.fecha,
        String(f.vuelta),
        f.enviado ? 'SI' : 'NO',
        f.confirmado ? 'SI' : 'NO',
      ]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [168, 168, 168], textColor: 0 },
      margin: { left: 10, right: 10 },
    })
  }

  // Hoja 2: detalle/observaciones de los mismos reportes (kardex útil para papás).
  // Legacy solo ponía informes tipo 5; con "Todos" eso dejaba la hoja vacía.
  const detalle = opts.filas.length ? opts.filas : (opts.informes ?? [])
  doc.addPage()
  encabezadoPdf(doc, `Detalle de reportes — ${opts.alumnoNombre}`, opts.ciclo)
  if (!detalle.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Sin detalle de reportes en este ciclo para este filtro.', 14, 48)
  } else {
    autoTable(doc, {
      startY: 42,
      head: [['#', 'Reporte', 'Materia', 'Fecha', 'RE', 'RC', 'Observaciones']],
      body: detalle.map((f, i) => [
        String(i + 1),
        f.reporteLabel,
        (f.materia || f.departamento || '').slice(0, 28),
        f.fecha,
        f.enviado ? 'SI' : 'NO',
        f.confirmado ? 'SI' : 'NO',
        (f.mensaje || f.motivo || '—').slice(0, 420),
      ]),
      styles: { fontSize: 7, cellPadding: 1.5, valign: 'top' },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 36 },
        2: { cellWidth: 40 },
        3: { cellWidth: 22 },
        4: { cellWidth: 12 },
        5: { cellWidth: 12 },
        6: { cellWidth: 'auto' },
      },
      headStyles: { fillColor: [168, 168, 168], textColor: 0 },
      margin: { left: 10, right: 10 },
    })
  }

  return Buffer.from(doc.output('arraybuffer'))
}

/** Etiqueta de columna «Reporte» alineada a secundaria_2.0. */
export function etiquetaReportePdf(tipo: number, no: number): string {
  if (tipo === 5 || tipo === 8) return etiquetaTipoReporte(tipo)
  if (no <= 0) return `Aviso ${etiquetaTipoReporte(tipo)}`
  return `Reporte ${no} ${etiquetaTipoReporte(tipo)}`
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
  mensaje?: string
  grado?: number
  grupo?: string
  nivel?: number
}): FilaPdfReporte {
  return {
    reporte_id: r.reporte_id,
    nombre: r.nombre,
    materia: r.materia ?? '',
    departamento: r.departamento ?? '',
    reporteLabel: etiquetaReportePdf(r.tipo, r.no),
    motivo: r.motivo,
    fecha: r.fecha,
    enviado: r.enviado,
    confirmado: r.confirmado,
    vuelta: r.vuelta,
    mensaje: r.mensaje ?? '',
    grado: r.grado,
    grupo: r.grupo,
    nivel: r.nivel,
  }
}

/** Orden legacy: grado → nombre → vuelta → no. */
export function ordenarFilasPdf(filas: FilaPdfReporte[]): FilaPdfReporte[] {
  return [...filas].sort((a, b) => {
    const g = (a.grado ?? 0) - (b.grado ?? 0)
    if (g !== 0) return g
    const n = a.nombre.localeCompare(b.nombre, 'es')
    if (n !== 0) return n
    const v = a.vuelta - b.vuelta
    if (v !== 0) return v
    return a.reporte_id - b.reporte_id
  })
}

export type FiltroPdfPendientes = {
  grado?: number
  grupo?: string
  /** Maternal/Kinder: desambigua grado entre niveles. */
  nivel?: number
}

export function filtrarFilasPdf(
  filas: FilaPdfReporte[],
  filtro?: FiltroPdfPendientes
): FilaPdfReporte[] {
  if (!filtro) return filas
  const grado = filtro.grado && filtro.grado > 0 ? filtro.grado : null
  const grupo = filtro.grupo?.trim().toUpperCase() || null
  const nivel = filtro.nivel && filtro.nivel > 0 ? filtro.nivel : null
  return filas.filter((f) => {
    if (nivel != null && (f.nivel ?? 0) !== nivel) return false
    if (grado != null && (f.grado ?? 0) !== grado) return false
    if (grupo && (f.grupo ?? '').toUpperCase() !== grupo) return false
    return true
  })
}

export { etiquetaEscalon, etiquetaTipoReporte, motivoReporte }
