import fs from 'fs'
import path from 'path'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { FilaInscripcionesAdmin, ResumenInscripcionesAdmin } from './inscripcionesAdminService'
import { escapeHtml } from './renderDocument'

const HEADERS = [
  'NIVEL',
  'RI ESTIMADOS',
  'RI INSCRITOS',
  'RI DIFERENCIA',
  'NI ESTIMADOS',
  'NI INSCRITOS',
  'NI DIFERENCIA',
  'TOTAL ESTIMADO',
  'TOTAL INSCRITOS',
] as const

const LOGO_PATH = path.join(process.cwd(), 'public/logos/logo-winston-churchill.png')

function etiquetaCicloLegacy(cicloLabel: string): string {
  return cicloLabel.replace('-', ' - ')
}

function fechaLegacyReporte(): string {
  const raw = new Date().toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return raw.replace(/ de ([a-záéíóúñ]+) de /i, (_, mes) => {
    const m = String(mes)
    return ` de ${m.charAt(0).toUpperCase()}${m.slice(1)} de `
  })
}

function filaATabla(f: FilaInscripcionesAdmin): string[] {
  const riDif = f.riEst - f.riPag
  const niDif = f.niEst - f.niPag
  return [
    f.nivelLabel,
    String(f.riEst),
    String(f.riPag),
    String(riDif),
    String(f.niEst),
    String(f.niPag),
    String(niDif),
    String(f.riEst + f.niEst),
    String(f.riPag + f.niPag),
  ]
}

function bloquesDesdeFilas(filas: FilaInscripcionesAdmin[]): FilaInscripcionesAdmin[][] {
  const bloques: FilaInscripcionesAdmin[][] = []
  let actual: FilaInscripcionesAdmin[] = []
  for (const f of filas) {
    actual.push(f)
    if (f.esTotales) {
      bloques.push(actual)
      actual = []
    }
  }
  return bloques
}

function filaHtml(f: FilaInscripcionesAdmin): string {
  const cells = filaATabla(f)
  const trClass = f.esTotales ? ' class="totales"' : ''
  const tdHtml = cells
    .map((c, i) => {
      const diff = i === 3 || i === 6
      const cls = diff ? ' class="diff"' : ''
      return `<td${cls}>${escapeHtml(c)}</td>`
    })
    .join('')
  return `<tr${trClass}>${tdHtml}</tr>`
}

function tablaHtml(bloque: FilaInscripcionesAdmin[]): string {
  const head = HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
  const body = bloque.map(filaHtml).join('')
  return `<table class="bloque"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

export function construirHtmlReporteInscripciones(resumen: ResumenInscripcionesAdmin): string {
  const bloques = bloquesDesdeFilas(resumen.filas)
  const tablas = bloques.map(tablaHtml).join('')
  const ciclo = etiquetaCicloLegacy(resumen.cicloLabel)
  const fecha = fechaLegacyReporte()

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(resumen.titulo)}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      margin: 0;
      padding: 18px 22px 24px;
      background: #fff;
    }
    .top {
      display: grid;
      grid-template-columns: 110px 1fr;
      gap: 12px;
      align-items: start;
      margin-bottom: 16px;
    }
    .logo { width: 96px; height: auto; display: block; }
    .head-block { text-align: center; padding-top: 4px; }
    .head-block h1 {
      margin: 0 0 6px;
      font-size: 1.05rem;
      font-weight: 700;
      color: #111827;
      letter-spacing: 0.01em;
    }
    .head-block p { margin: 0 0 3px; font-size: 0.82rem; color: #1f2937; }
    .bloque {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      margin: 0 0 14px;
    }
    .bloque th {
      background: #1e3a5f;
      color: #fff;
      font-weight: 700;
      padding: 6px 5px;
      border: 1px solid #16304f;
      text-align: center;
      font-size: 9.5px;
    }
    .bloque td {
      border: 1px solid #94a3b8;
      padding: 4px 5px;
      text-align: center;
      background: #fff;
    }
    .bloque td:first-child {
      text-align: left;
      font-weight: 600;
      padding-left: 8px;
      min-width: 108px;
    }
    .bloque tbody tr:nth-child(even):not(.totales) td:not(.diff) { background: #e8f1fa; }
    .bloque td.diff { background: #4a90c8 !important; color: #fff; font-weight: 700; }
    .bloque tr.totales td:not(.diff) { background: #dbe4ee !important; font-weight: 800; }
    .bloque tr.totales td.diff { background: #2f6fa8 !important; color: #fff; }
    .legend {
      margin-top: 4px;
      padding: 5px 10px;
      background: #1e3a5f;
      color: #fff;
      font-size: 9.5px;
      font-weight: 600;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="top">
    <img class="logo" src="/logos/logo-winston-churchill.png" alt="Instituto Winston Churchill" />
    <div class="head-block">
      <h1>${escapeHtml(resumen.titulo)}</h1>
      <p>Ciclo Escolar ${escapeHtml(ciclo)}</p>
      <p>${escapeHtml(fecha)}</p>
    </div>
  </div>
  ${tablas}
  <p class="legend">Donde: NI= Nuevo Ingreso; RI= Reinscritos</p>
</body>
</html>`
}

function leerLogoBase64(): string | null {
  try {
    if (!fs.existsSync(LOGO_PATH)) return null
    return fs.readFileSync(LOGO_PATH).toString('base64')
  } catch {
    return null
  }
}

export function generarPdfReporteInscripciones(resumen: ResumenInscripcionesAdmin): Buffer {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const ciclo = etiquetaCicloLegacy(resumen.cicloLabel)
  const fecha = fechaLegacyReporte()

  const logo = leerLogoBase64()
  if (logo) {
    pdf.addImage(logo, 'PNG', 14, 10, 26, 26)
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.setTextColor(17, 24, 39)
  pdf.text(resumen.titulo, pageW / 2, 16, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(`Ciclo Escolar ${ciclo}`, pageW / 2, 22, { align: 'center' })
  pdf.text(fecha, pageW / 2, 27, { align: 'center' })

  let startY = 36
  const bloques = bloquesDesdeFilas(resumen.filas)

  for (const bloque of bloques) {
    autoTable(pdf, {
      startY,
      head: [HEADERS as unknown as string[]],
      body: bloque.map((f) => filaATabla(f)),
      styles: { fontSize: 7, cellPadding: 1.5, halign: 'center', valign: 'middle', lineColor: [148, 163, 184] },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 32 },
        3: { fillColor: [74, 144, 200], textColor: 255, fontStyle: 'bold' },
        6: { fillColor: [74, 144, 200], textColor: 255, fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: [232, 241, 250] },
      didParseCell(data) {
        const fila = bloque[data.row.index]
        if (!fila?.esTotales || data.section !== 'body') return
        data.cell.styles.fontStyle = 'bold'
        if (data.column.index !== 3 && data.column.index !== 6) {
          data.cell.styles.fillColor = [219, 228, 238]
          data.cell.styles.textColor = 17
        }
      },
      margin: { left: 12, right: 12 },
      theme: 'grid',
    })
    startY = ((pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY) + 5
  }

  pdf.setFillColor(30, 58, 95)
  pdf.rect(12, startY + 1, pageW - 24, 5.5, 'F')
  pdf.setFontSize(7)
  pdf.setTextColor(255, 255, 255)
  pdf.text('Donde: NI= Nuevo Ingreso; RI= Reinscritos', 14, startY + 4.8)

  return Buffer.from(pdf.output('arraybuffer'))
}
