'use client'

import { jsPDF } from 'jspdf'
import { getFullLevel } from '@/lib/boucherCore'
import { importeEnLetrasPesos } from '@/lib/importeEnLetras'

export interface DatosValePagoInterno {
  fecha: string
  importe: number
  concepto: string
  conceptoExtra?: string
  nombreAlumno: string
  alumnoApp: string
  alumnoApm: string
  alumnoNombre: string
  alumnoNivel: number
  alumnoGrado: number | string | null
  cicloEtiqueta: string
}

const MESES_CORTO = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]

/** Márgenes FPDF por defecto (mm). */
const L_MARGIN = 10
const T_MARGIN = 10

function partesFecha(iso: string): { dia: string; mes: string; anio: string } {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return { dia: '', mes: '', anio: '' }
  return {
    dia: String(d).padStart(2, '0'),
    mes: MESES_CORTO[m - 1] ?? '',
    anio: String(y),
  }
}

function nombreValeLegacy(app: string, apm: string, nombre: string): string {
  return [app, apm, nombre].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toUpperCase()
}

function limpiarConcepto(texto: string): string {
  return texto.replace(/^\*\s*/, '').trim().toUpperCase()
}

function aniosCiclo(etiqueta: string): { inicio: string; fin: string } {
  const nums = etiqueta.match(/\d{4}/g) ?? []
  return { inicio: nums[0] ?? '', fin: nums[1] ?? nums[0] ?? '' }
}

function importeNumericoLegacy(importe: number): string {
  return Number(importe).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function textoConcepto(datos: DatosValePagoInterno): string {
  let base = limpiarConcepto(datos.concepto)
  const extra = datos.conceptoExtra?.trim()
    ? ` ${datos.conceptoExtra.trim().toUpperCase()}`
    : ''
  // Legacy: MANUALES + licencia en primaria/secundaria (nivel > 2)
  if (base === 'MANUALES' && Number(datos.alumnoNivel) > 2) {
    base = `${base} + LICENCIA DE EMPRENDIMIENTO`
  }
  return `${base}${extra}`.trim()
}

/**
 * PDF del vale — mismas medidas que `servicios/module/callback_3.php` (FPDF Letter landscape).
 * Dos páginas idénticas: original + copia del talón.
 */
export function generarPdfValePagoInterno(datos: DatosValePagoInterno): jsPDF {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter',
  })

  dibujarPaginaVale(pdf, datos)
  pdf.addPage('letter', 'landscape')
  dibujarPaginaVale(pdf, datos)

  return pdf
}

function dibujarPaginaVale(pdf: jsPDF, datos: DatosValePagoInterno): void {
  const { dia, mes, anio } = partesFecha(datos.fecha)
  const letras = importeEnLetrasPesos(datos.importe)
  const concepto = textoConcepto(datos)
  const nombre = nombreValeLegacy(datos.alumnoApp, datos.alumnoApm, datos.alumnoNombre)
  const grado = getFullLevel(Number(datos.alumnoNivel), Number(datos.alumnoGrado ?? 0))
  const { inicio, fin } = aniosCiclo(datos.cicloEtiqueta)
  const importeFmt = importeNumericoLegacy(datos.importe)

  // Port de FPDF Ln(73) + 4mm base; ajustes finos por campo abajo.
  const yBase = T_MARGIN + 73 + 4
  const cellH = 6

  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(0, 0, 0)

  // Fecha: −3mm vertical, horizontal 185
  const yFecha = yBase - 3
  pdf.setFontSize(10)
  let x = L_MARGIN + 185
  pdf.text(dia, x + 13 / 2, yFecha + 4, { align: 'center' })
  x += 13
  pdf.text(mes, x + 13 / 2 - 0.5, yFecha + 4, { align: 'center' })
  x += 13
  pdf.text(anio, x + 13 / 2, yFecha + 4, { align: 'center' })

  // Importe numérico (caja $): 13pt, −1.5mm
  const yImporte = yBase + 9 - 1.5
  pdf.setFontSize(13)
  x = L_MARGIN + 200
  pdf.text(importeFmt, x, yImporte + 4, { align: 'left' })

  // Importe en letras: −0.5mm
  const yLetras = yBase + 9 + 15 - 0.5
  pdf.setFontSize(10)
  x = L_MARGIN + 115
  pdf.text(letras, x, yLetras + 4, { align: 'left', maxWidth: 150 })

  // Concepto
  const yConcepto = yBase + 9 + 15 + cellH
  pdf.setFontSize(10)
  x = L_MARGIN + 115
  pdf.text(concepto, x, yConcepto + 4, { align: 'left', maxWidth: 150 })

  // Nombre: +0.5mm
  const yNombre = yBase + 9 + 15 + cellH + cellH + 0.5
  x = L_MARGIN + 115
  pdf.text(nombre, x, yNombre + 4, { align: 'left', maxWidth: 150 })

  // Grado + ciclo: −0.9mm; ciclo inicio →2mm, fin →0.5mm
  const yGrado = yBase + 9 + 15 + cellH + cellH + 8 - 0.9
  x = L_MARGIN + 115
  pdf.text(grado, x, yGrado + 4, { align: 'left' })
  x += 40 + 20
  pdf.text(inicio, x + 30 / 2 + 2, yGrado + 4, { align: 'center' })
  x += 30 + 20
  pdf.text(fin, x + 30 / 2 + 0.5, yGrado + 4, { align: 'center' })
}

/** Imprime original + copia (2 páginas del mismo vale). */
export function imprimirValePagoInterno(datos: DatosValePagoInterno): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const pdf = generarPdfValePagoInterno(datos)
  const blob = pdf.output('blob')
  const url = URL.createObjectURL(blob)

  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'vale-pago-interno')
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;'
  document.body.appendChild(iframe)

  const cleanup = () => {
    window.setTimeout(() => {
      try {
        iframe.remove()
        URL.revokeObjectURL(url)
      } catch {
        /* ignore */
      }
    }, 2000)
  }

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      cleanup()
    }
  }
  iframe.src = url
}

export default function ValePagoInternoPrint(_props: {
  datos: DatosValePagoInterno | null
}) {
  return null
}
