import fs from 'fs'
import path from 'path'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type {
  GrupoBloqueoInscripciones,
  ResumenInscripcionesAdmin,
  FilaInscripcionesAdmin,
} from './inscripcionesAdminService'
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

const LOGO_IWC_PATH = path.join(process.cwd(), 'public/logos/logo-winston-churchill.png')
const LOGO_IEW_PATH = path.join(process.cwd(), 'public/logos/logo-winston-educativo.png')

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
      const totalIn = i === 8
      const cls = diff ? ' class="diff"' : totalIn ? ' class="total-in"' : ''
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

function bloqueosHtml(grupos: GrupoBloqueoInscripciones[]): string {
  if (!grupos.length) return ''
  const total = grupos.reduce((n, g) => n + g.alumnos.length, 0)
  const secciones = grupos
    .map((g) => {
      const filas = g.alumnos
        .map(
          (a, i) =>
            `<tr><td class="num">${i + 1}</td><td class="ctrl">${escapeHtml(a.noCtrl)}</td><td class="nom">${escapeHtml(a.nombre)}</td><td class="act">${escapeHtml(a.nivelActualLabel)}</td></tr>`
        )
        .join('')
      return `<div class="bloqueo-grupo">
  <h3>${escapeHtml(g.tituloGrupo)} <span>(${g.alumnos.length})</span></h3>
  <table class="bloqueo-tabla">
    <thead><tr><th>#</th><th>No. Ctrl</th><th>Nombre</th><th>Grado actual</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
</div>`
    })
    .join('')

  return `<section class="bloqueos">
  <h2>Bloqueo psicológico / académico (estatus 4) — ${total}</h2>
  <p class="bloqueo-nota">Alumnos que no avanzan de ciclo por bloqueo de psicología o académico. Se indica el ciclo/grado en el que deberían estar.</p>
  ${secciones}
</section>`
}

export function construirHtmlReporteInscripciones(resumen: ResumenInscripcionesAdmin): string {
  const bloques = bloquesDesdeFilas(resumen.filas)
  const tablas = bloques.map(tablaHtml).join('')
  const ciclo = etiquetaCicloLegacy(resumen.cicloLabel)
  const fecha = fechaLegacyReporte()
  const bloqueos = bloqueosHtml(resumen.bloqueos ?? [])

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
      grid-template-columns: 96px 1fr 96px;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
    }
    .logo { width: 88px; height: auto; display: block; margin: 0 auto; }
    .head-block { text-align: center; padding: 0 4px; }
    .head-block .t1 {
      margin: 0 0 6px;
      font-size: 1.35rem;
      font-weight: 700;
      color: #111827;
    }
    .head-block p { margin: 0 0 3px; font-size: 0.95rem; color: #1f2937; }
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
    .bloque td.total-in { background: #96befc !important; font-weight: 700; }
    .bloque tr.totales td:not(.diff):not(.total-in) { background: #dbe4ee !important; font-weight: 800; }
    .bloque tr.totales td.diff { background: #2f6fa8 !important; color: #fff; }
    .bloque tr.totales td.total-in { background: #96befc !important; font-weight: 800; }
    .legend {
      margin-top: 4px;
      padding: 5px 10px;
      background: #1e3a5f;
      color: #fff;
      font-size: 9.5px;
      font-weight: 600;
      display: inline-block;
    }
    .bloqueos {
      margin-top: 22px;
      page-break-inside: avoid;
    }
    .bloqueos h2 {
      margin: 0 0 4px;
      font-size: 0.95rem;
      color: #7c2d12;
    }
    .bloqueo-nota {
      margin: 0 0 10px;
      font-size: 0.78rem;
      color: #6b7280;
    }
    .bloqueo-grupo { margin: 0 0 12px; }
    .bloqueo-grupo h3 {
      margin: 0 0 4px;
      font-size: 0.82rem;
      color: #1e3a5f;
    }
    .bloqueo-grupo h3 span { font-weight: 600; color: #6b7280; }
    .bloqueo-tabla {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    .bloqueo-tabla th {
      background: #7c2d12;
      color: #fff;
      padding: 4px 6px;
      text-align: left;
      border: 1px solid #9a3412;
    }
    .bloqueo-tabla td {
      border: 1px solid #d6d3d1;
      padding: 3px 6px;
    }
    .bloqueo-tabla td.num { width: 28px; text-align: center; color: #6b7280; }
    .bloqueo-tabla td.ctrl { width: 72px; font-weight: 600; }
    .bloqueo-tabla td.act { width: 110px; color: #6b7280; font-size: 9.5px; }
    .bloqueo-tabla tbody tr:nth-child(even) td { background: #fff7ed; }
  </style>
</head>
<body>
  <div class="top">
    <img class="logo" src="/logos/logo-winston-churchill.png" alt="Instituto Winston Churchill" />
    <div class="head-block">
      <p class="t1">Inscripciones</p>
      <p>Ciclo Escolar ${escapeHtml(ciclo)}</p>
      <p>${escapeHtml(fecha)}</p>
    </div>
    <img class="logo" src="/logos/logo-winston-educativo.png" alt="Winston Educativo" />
  </div>
  ${tablas}
  <p class="legend">Donde: NI= Nuevo Ingreso; RI= Reinscritos</p>
  ${bloqueos}
</body>
</html>`
}

function leerLogoBase64(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath).toString('base64')
  } catch {
    return null
  }
}

export function generarPdfReporteInscripciones(resumen: ResumenInscripcionesAdmin): Buffer {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const ciclo = etiquetaCicloLegacy(resumen.cicloLabel)
  const fecha = fechaLegacyReporte()

  const logoIzq = leerLogoBase64(LOGO_IWC_PATH)
  const logoDer = leerLogoBase64(LOGO_IEW_PATH)
  const logoW = 24
  const logoY = 10
  if (logoIzq) {
    pdf.addImage(logoIzq, 'PNG', 12, logoY, logoW, logoW)
  }
  if (logoDer) {
    pdf.addImage(logoDer, 'PNG', pageW - 12 - logoW, logoY, logoW, logoW)
  }

  const midX = pageW / 2
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.setTextColor(17, 24, 39)
  pdf.text('Inscripciones', midX, 18, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.text(`Ciclo Escolar ${ciclo}`, midX, 26, { align: 'center' })
  pdf.setFontSize(10)
  pdf.text(fecha, midX, 32, { align: 'center' })

  let startY = 40
  const bloques = bloquesDesdeFilas(resumen.filas)

  for (const bloque of bloques) {
    autoTable(pdf, {
      startY,
      head: [HEADERS as unknown as string[]],
      body: bloque.map((f) => filaATabla(f)),
      styles: { fontSize: 7, cellPadding: 1.5, halign: 'center', valign: 'middle', lineColor: [148, 163, 184] },
      headStyles: { fillColor: [38, 80, 142], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 32, fillColor: [150, 190, 252] },
        3: { fillColor: [54, 116, 210], textColor: 255, fontStyle: 'bold' },
        6: { fillColor: [54, 116, 210], textColor: 255, fontStyle: 'bold' },
        7: { fillColor: [150, 190, 252] },
        8: { fillColor: [150, 190, 252] },
      },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      didParseCell(data) {
        const fila = bloque[data.row.index]
        if (!fila?.esTotales || data.section !== 'body') return
        data.cell.styles.fontStyle = 'bold'
        if (data.column.index !== 3 && data.column.index !== 6) {
          data.cell.styles.fillColor = [150, 190, 252]
          data.cell.styles.textColor = 17
        }
      },
      margin: { left: 12, right: 12 },
      theme: 'grid',
    })
    startY = ((pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY) + 5
  }

  pdf.setFillColor(38, 80, 142)
  pdf.rect(12, startY + 1, pageW - 24, 5.5, 'F')
  pdf.setFontSize(7)
  pdf.setTextColor(255, 255, 255)
  pdf.text('Donde: NI= Nuevo Ingreso; RI= Reinscritos', 14, startY + 4.8)

  const grupos = resumen.bloqueos ?? []
  if (grupos.length) {
    let y = startY + 12
    const total = grupos.reduce((n, g) => n + g.alumnos.length, 0)
    const pageH = pdf.internal.pageSize.getHeight()

    const asegurarEspacio = (mm: number) => {
      if (y + mm <= pageH - 12) return
      pdf.addPage()
      y = 16
    }

    asegurarEspacio(18)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(124, 45, 18)
    pdf.text(`Bloqueo psicológico / académico (estatus 4) — ${total}`, 12, y)
    y += 5
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(107, 114, 128)
    pdf.text(
      'Alumnos que no avanzan de ciclo. Se indica el ciclo/grado en el que deberían estar.',
      12,
      y
    )
    y += 4

    for (const g of grupos) {
      asegurarEspacio(22)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor(30, 58, 95)
      pdf.text(`${g.tituloGrupo} (${g.alumnos.length})`, 12, y)
      y += 2
      autoTable(pdf, {
        startY: y,
        head: [['#', 'No. Ctrl', 'Nombre', 'Grado actual']],
        body: g.alumnos.map((a, i) => [
          String(i + 1),
          a.noCtrl,
          a.nombre,
          a.nivelActualLabel,
        ]),
        styles: { fontSize: 7.5, cellPadding: 1.4, valign: 'middle', lineColor: [214, 211, 209] },
        headStyles: {
          fillColor: [124, 45, 18],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 7.5,
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center', textColor: [107, 114, 128] },
          1: { cellWidth: 22, fontStyle: 'bold' },
          3: { cellWidth: 28, textColor: [107, 114, 128] },
        },
        alternateRowStyles: { fillColor: [255, 247, 237] },
        margin: { left: 12, right: 12 },
        theme: 'grid',
      })
      y = ((pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 5
    }
  }

  return Buffer.from(pdf.output('arraybuffer'))
}
