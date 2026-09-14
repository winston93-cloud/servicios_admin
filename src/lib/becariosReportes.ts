import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import type { BecarioEntrada } from '@/lib/becariosService'

function fmtFecha(f: string): string {
  const [y, m, d] = f.slice(0, 10).split('-')
  if (!y || !m || !d) return f
  return `${d}/${m}/${y}`
}

function bloque(doc: jsPDF, titulo: string, texto: string, y: number, maxW: number): number {
  const body = String(texto || '—').trim() || '—'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(titulo, 14, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const lines = doc.splitTextToSize(body, maxW)
  doc.text(lines, 14, y)
  return y + lines.length * 4.2 + 4
}

export function pdfBitacoraBecario(opts: {
  nombre: string
  desde: string
  hasta: string
  entradas: BecarioEntrada[]
}): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const maxW = 182
  let y = 16

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Bitácora de becarios — Instituto Winston Churchill', 14, y)
  y += 7
  doc.setFontSize(11)
  doc.text(`Becario: ${opts.nombre}`, 14, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Periodo: ${fmtFecha(opts.desde)} — ${fmtFecha(opts.hasta)}`, 14, y)
  y += 6
  doc.text(`Entradas: ${opts.entradas.length}`, 14, y)
  y += 8

  if (!opts.entradas.length) {
    doc.text('Sin registros en el periodo.', 14, y)
  }

  for (const e of opts.entradas) {
    if (y > 250) {
      doc.addPage()
      y = 16
    }
    doc.setDrawColor(180)
    doc.line(14, y, 196, y)
    y += 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    const quien = e.becario_nombre ? `${e.becario_nombre} · ` : ''
    const titulo = e.entrada_titulo ? ` — ${e.entrada_titulo}` : ''
    doc.text(`${quien}${fmtFecha(e.entrada_fecha)}${titulo}`, 14, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    if (e.horas_aproximadas != null) {
      doc.text(`Horas aprox.: ${e.horas_aproximadas}`, 14, y)
      y += 5
    }
    y = bloque(doc, 'Avances', e.avances, y, maxW)
    if (e.observaciones) y = bloque(doc, 'Observaciones', e.observaciones, y, maxW)
    if (e.apuntes) y = bloque(doc, 'Apuntes', e.apuntes, y, maxW)
    if (e.pendientes) y = bloque(doc, 'Pendientes', e.pendientes, y, maxW)
    if (e.aprendizajes) y = bloque(doc, 'Aprendizajes', e.aprendizajes, y, maxW)
    y += 2
  }

  const ab = doc.output('arraybuffer')
  return Buffer.from(ab)
}

export async function excelBitacoraBecario(opts: {
  nombre: string
  desde: string
  hasta: string
  entradas: BecarioEntrada[]
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'servicios_admin'
  const ws = wb.addWorksheet('Bitácora')
  ws.columns = [
    { header: 'Becario', key: 'becario', width: 16 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Título', key: 'titulo', width: 28 },
    { header: 'Horas', key: 'horas', width: 8 },
    { header: 'Avances', key: 'avances', width: 45 },
    { header: 'Observaciones', key: 'observaciones', width: 35 },
    { header: 'Apuntes', key: 'apuntes', width: 35 },
    { header: 'Pendientes', key: 'pendientes', width: 30 },
    { header: 'Aprendizajes', key: 'aprendizajes', width: 30 },
    { header: 'Estado', key: 'estado', width: 12 },
  ]
  ws.getRow(1).font = { bold: true }
  for (const e of opts.entradas) {
    ws.addRow({
      becario: e.becario_nombre || e.becario_username,
      fecha: fmtFecha(e.entrada_fecha),
      titulo: e.entrada_titulo,
      horas: e.horas_aproximadas ?? '',
      avances: e.avances,
      observaciones: e.observaciones,
      apuntes: e.apuntes,
      pendientes: e.pendientes,
      aprendizajes: e.aprendizajes,
      estado: e.estado,
    })
  }
  ws.addRow([])
  ws.addRow([`Becario: ${opts.nombre}`, `Periodo: ${fmtFecha(opts.desde)} — ${fmtFecha(opts.hasta)}`])
  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
